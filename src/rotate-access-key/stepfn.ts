import { join } from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  DockerImageFunction,
  DockerImageCode,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  Choice,
  Condition,
  Fail,
  Pass,
  StateMachine,
  Succeed,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import {
  AZURE_CLI_ECR,
  AZURE_DEVOPS_IAM_USER_NAME,
  AZURE_DEVOPS_ORGANIZATION,
  AZURE_DEVOPS_SECRET_MANAGER_NAME,
  AZURE_DEVOPS_SSM_PAT_NAME,
  AZURE_SIMFLEX_CLOUD_PROJECT_ID,
  AZURE_SIMFLEX_CLOUD_PROJECT_NAME,
  AZURE_SVC_CONNECTION_NAME,
  KMS_LAMBDA_KEY_ARN,
  SLACK_WEBHOOK_URL_ALARM_ACCESS_KEY_SSM,
} from './constants';
import { EnvironmentConfig } from '../shared/global/environment';

export class RotateAccessKeyAzureCLi extends Stack {
  constructor(
    scope: Construct,
    id: string,
    reg: EnvironmentConfig,
    props: StackProps,
  ) {
    super(scope, id, props);

    const prefix = `${reg.pattern}-${reg.stage}-azure-devops-sfn`;

    /**
     * IAM role to handle rotate access key and put to secret manager
     * This role is used by all lambda functions within the step function
     */
    const rotateRole = new Role(this, `${prefix}-rotate-key-role`, {
      roleName: `${prefix}-rotate-key`,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    const iamListSts = new PolicyStatement({
      sid: 'ListUser',
      actions: ['iam:List*'],
      resources: ['*'],
    });

    const iamSts = new PolicyStatement({
      sid: 'RotateAccessKey',
      actions: [
        'iam:CreateAccessKey',
        'iam:DeleteAccessKey',
        'iam:UpdateAccessKey',
        'iam:GetAccessKeyLastUsed',
        'iam:GetUser',
      ],
      resources: [`arn:aws:iam::${reg.account}:user/${AZURE_DEVOPS_IAM_USER_NAME}`],
    });

    const scmSts = new PolicyStatement({
      sid: 'SecretManager',
      actions: [
        'secretsmanager:PutResourcePolicy',
        'secretsmanager:PutSecretValue',
        'secretsmanager:DescribeSecret',
        'secretsmanager:CreateSecret',
        'secretsmanager:GetResourcePolicy',
        'secretsmanager:ReplicateSecretToRegions',
        'secretsmanager:GetSecretValue',
      ],
      resources: [`arn:aws:secretsmanager:${reg.region}:${reg.account}:secret:${AZURE_DEVOPS_SECRET_MANAGER_NAME}-*`],
    });

    let kmsKey = Key.fromKeyArn(this, 'KmsKey', KMS_LAMBDA_KEY_ARN);

    const azurePAT = StringParameter.fromSecureStringParameterAttributes(
      this,
      AZURE_DEVOPS_SSM_PAT_NAME,
      {
        parameterName: AZURE_DEVOPS_SSM_PAT_NAME,
        encryptionKey: kmsKey,
      },
    );
    azurePAT.grantRead(rotateRole);

    const slackWebhookUrl = StringParameter.fromSecureStringParameterAttributes(
      this,
      SLACK_WEBHOOK_URL_ALARM_ACCESS_KEY_SSM,
      {
        parameterName: SLACK_WEBHOOK_URL_ALARM_ACCESS_KEY_SSM,
        encryptionKey: kmsKey,
      },
    );
    slackWebhookUrl.grantRead(rotateRole);

    [iamListSts, iamSts, scmSts].forEach(sts => {
      rotateRole.addToPolicy(sts);
    });

    /**
     * Lambda function to rotate access key function: Create new access key and update to secret manager,
     * then delete the old one
     */
    const rotateKeyLambda = new PythonFunction(this, `${prefix}-rotate-key`, {
      functionName: `${prefix}-rotate-key`,
      role: rotateRole,
      logRetention: RetentionDays.ONE_WEEK,
      entry: join(__dirname, 'lambda-handler'),
      index: 'rotate-access-key.py',
      timeout: Duration.seconds(60),
      runtime: Runtime.PYTHON_3_9,
      environment: {
        IAM_USER_NAME: AZURE_DEVOPS_IAM_USER_NAME,
        AWS_SCM_NAME: AZURE_DEVOPS_SECRET_MANAGER_NAME,
      },
    });

    /**
     * Lambda function Simply send slack message with flag info|alert
     */
    const sendSlackLambda = new PythonFunction(this, `${prefix}-sendslack`, {
      functionName: `${prefix}-send-slack`,
      role: rotateRole,
      logRetention: RetentionDays.ONE_WEEK,
      entry: join(__dirname, 'lambda-handler/send-slack'),
      index: 'send-slack.py',
      timeout: Duration.seconds(60),
      runtime: Runtime.PYTHON_3_9,
      environment: {
        AWS_SLACK_WEBHOOK_URL_SSM: SLACK_WEBHOOK_URL_ALARM_ACCESS_KEY_SSM,
      },
    });

    /**
     * Lambda function to create Azure service connection with AWS type
     */
    const createAzureSvcEndpointLambda = new DockerImageFunction(
      this,
      `${prefix}-azure-svc-endpoint`,
      {
        functionName: `${prefix}-azure-svc-endpoint`,
        role: rotateRole,
        logRetention: RetentionDays.ONE_WEEK,
        code: DockerImageCode.fromEcr(
          Repository.fromRepositoryArn(
            this,
            `${prefix}-azure-cli-repo`,
            AZURE_CLI_ECR,
          ),
        ),
        timeout: Duration.minutes(3),
        memorySize: 256,
        environment: {
          PROJ_ID: AZURE_SIMFLEX_CLOUD_PROJECT_ID,
          PROJ_NAME: AZURE_SIMFLEX_CLOUD_PROJECT_NAME,
          ORG: AZURE_DEVOPS_ORGANIZATION,
          AWS_ACCOUNT: `${reg.account}`,
          AZURE_SVC_NAME: AZURE_SVC_CONNECTION_NAME,
          AWS_ROLE_NAME: AZURE_DEVOPS_IAM_USER_NAME,
          AWS_SECRET_NAME: AZURE_DEVOPS_SECRET_MANAGER_NAME,
          AWS_AZURE_DEVOPS_SSM_PAT: AZURE_DEVOPS_SSM_PAT_NAME,
        },
      },
    );

    /**
     * Statemachine tasks
     */
    const rotateKey = new LambdaInvoke(this, `${prefix}-rotate-key-task`, {
      lambdaFunction: rotateKeyLambda,
      outputPath: '$.Payload',
    });

    const sendSlackSuccess = new LambdaInvoke(this, `${prefix}-send-slack-task`, {
      lambdaFunction: sendSlackLambda,
      outputPath: '$.Payload',
    });

    const sendSlackFailRotate = new LambdaInvoke(this, `${prefix}-send-slack-fail-rotate-task`, {
      lambdaFunction: sendSlackLambda,
      outputPath: '$.Payload',
    });

    const sendSlackFailCreateSvc = new LambdaInvoke(this, `${prefix}-send-slack-fail-create-svc-task`, {
      lambdaFunction: sendSlackLambda,
      outputPath: '$.Payload',
    });

    const createAzureSvcEndpoint = new LambdaInvoke(
      this,
      `${prefix}-azure-svc-endpoint-task`,
      {
        lambdaFunction: createAzureSvcEndpointLambda,
        outputPath: '$.Payload',
      },
    );

    /**
     * Chain
     */
    const definition = rotateKey
      .next(
        new Choice(this, 'Rotate access key successfully?')
          .when(
            Condition.booleanEquals('$.Status', false),
            sendSlackFailRotate.next(new Fail(this, 'Failed to rotate access key')),
          )
          .otherwise(
            new Pass(this, 'Passing to new states'),
          )
          .afterwards(),
      )
      .next(createAzureSvcEndpoint)
      .next(
        new Choice(this, 'Create Azure service endpoint successfully?')
          .when(
            Condition.booleanEquals('$.Status', false),
            sendSlackFailCreateSvc.next(new Fail(this, 'Failed to create Azure service endpoint')),
          )
          .otherwise(
            sendSlackSuccess.next(new Succeed(this, 'Successfully create Azure service endpoint')),
          ),
      );

    const stm = new StateMachine(this, `${prefix}-statemachine`, {
      stateMachineName: `${prefix}-rotate-access-key`,
      definition: definition,
    });

    /**
     * Eventbridge rule: Weekly trigger statemachine to rotace access key
     */
    const eventRule = new Rule(this, `${prefix}-rule`, {
      description: 'Weekly rotate access key of Azure Devops service connection User',
      ruleName: `${prefix}-weekly`,
      schedule: Schedule.cron({
        hour: '0',
        minute: '0',
        weekDay: 'SUN',
      }),
    });

    eventRule.addTarget(new SfnStateMachine(stm));
  }
}
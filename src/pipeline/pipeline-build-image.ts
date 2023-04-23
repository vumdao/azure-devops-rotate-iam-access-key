import { Stack, StackProps } from 'aws-cdk-lib';
import { PipelineProject, BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { Repository as codecommitRepo } from 'aws-cdk-lib/aws-codecommit';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, CodeCommitSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AZURE_CLI_ECR, AZURE_CLI_IMAGE_REPO_NAME } from '../rotate-access-key/constants';
import { EnvironmentConfig } from '../shared/global/environment';
import { devEnv } from '../shared/ap-southeast-1/environment';

export class AzureDevopsBuildImage extends Stack {
  constructor(
    scope: Construct,
    id: string,
    reg: EnvironmentConfig,
    props: StackProps,
  ) {
    super(scope, id, props);

    const prefix = `${reg.pattern}-simflexcloud-${reg.stage}-azure-devops-build-image`;

    const ecr = Repository.fromRepositoryArn(
      this,
      `${prefix}-azure-cli-repo`,
      AZURE_CLI_ECR,
    );

    /**
     * CodeBuild role to pull/push ECR and update lambda function code
     * The function is not from region of pipeline/build project
     */
    const role = new Role(this, `${prefix}-role`, {
      roleName: `${prefix}`,
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
    });

    ecr.grantPullPush(role);

    const funcName = `${devEnv.pattern}-simflexcloud-${devEnv.stage}-azure-devops-sfn-azure-svc-endpoint`;
    role.addToPolicy(new PolicyStatement({
      sid: 'UpdateFunctionCode',
      actions: [
        'lambda:UpdateFunctionCode',
      ],
      resources: [`arn:aws:lambda:${devEnv.region}:${reg.account}:function:${funcName}`],
    }));

    /**
     * Pipeline build docker image
     */
    const sourceOutput = new Artifact();

    const pipelineProject = new PipelineProject(this, `${prefix}-codebuild`, {
      projectName: `${prefix}-codebuild`,
      description: 'Pipeline for azure-devops-build-image',
      buildSpec: BuildSpec.fromSourceFilename('src/docker/buildspec.yml'),
      environment: {
        privileged: true,
        buildImage: LinuxBuildImage.STANDARD_6_0
      },
      environmentVariables: {
        IMAGE_REPO_NAME: { value: AZURE_CLI_IMAGE_REPO_NAME },
        IMAGE_TAG: { value: 'latest' },
        AWS_ACCOUNT_ID: { value: reg.account },
        AWS_DEFAULT_REGION: { value: devEnv.region },
        LAMBDA_FUNC_NAME: { value: funcName },
      },
      role: role,
    });

    const pipeline = new Pipeline(this, `${prefix}-pipeline`, {
      pipelineName: 'azure-devops-build-image-master',
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [new CodeCommitSourceAction({
        actionName: 'CodeCommit',
        repository: codecommitRepo.fromRepositoryName(this, `${prefix}-azure-devops-iam-user`, 'azure-devops-iam-user'),
        output: sourceOutput,
        branch: 'master',
      })],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [new CodeBuildAction({
        actionName: 'CodeBuild',
        project: pipelineProject,
        input: sourceOutput,
      })],
    });
  }
}

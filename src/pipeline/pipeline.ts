import { Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import {
  CodeBuildStep,
  CodePipeline,
  CodePipelineSource,
} from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { AzureDevopsIamRunnerPipelineStage } from './pipeline-stage';
import { devEnv } from '../shared/ap-southeast-1/environment';

export class AzureDevopsIamRunnerPipeline extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const prefix = 'azure-devops-iam-user';

    const repository = new Repository(this, prefix, {
      description: 'azure-devops-iam-user',
      repositoryName: prefix,
    });

    /**
     * Generate CDK pipeline function with input branch name
     */
    const genPipeline = function (_scope: Construct, branch: string) {
      const _pipeline = new CodePipeline(_scope, `${prefix}-${branch}`, {
        pipelineName: `${prefix}-${branch}`,
        useChangeSets: false,
        synth: new CodeBuildStep('SynthStep', {
          input: CodePipelineSource.codeCommit(repository, branch),
          installCommands: ['npm install -g aws-cdk'],
          commands: [
            'yarn install --frozen-lockfile',
            'npx projen build',
            'npx projen synth',
          ],
        }),
        codeBuildDefaults: {
          buildEnvironment: { privileged: true },
          partialBuildSpec: BuildSpec.fromObject({
            cache: {
              paths: ['${CODEBUILD_SRC_DIR}/node_modules/**/*'],
            },
          }),
        },
        dockerEnabledForSynth: true,
        dockerEnabledForSelfMutation: true,
      });
      return _pipeline;
    };

    /**
     * Deploy on master branch
     */
    const pipeline = genPipeline(this, 'master');
    pipeline.addStage(
      new AzureDevopsIamRunnerPipelineStage(
        this,
        `master-${prefix}-${devEnv.envTag}`,
        devEnv,
      ),
    );
  }
}

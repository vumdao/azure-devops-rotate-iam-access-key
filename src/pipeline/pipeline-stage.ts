import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RotateAccessKeyAzureCLi } from '../rotate-access-key/stepfn';
import { EnvironmentConfig } from '../shared/global/environment';

export class AzureDevopsIamRunnerPipelineStage extends Stage {
  constructor(
    scope: Construct,
    id: string,
    reg: EnvironmentConfig,
    props?: StageProps,
  ) {
    super(scope, id, props);

    /**
     * Weekly rotate access key
     */
    new RotateAccessKeyAzureCLi(this, 'azure-devops-rotate-access-key', reg, {
      env: reg,
    });
  }
}

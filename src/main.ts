import { App } from 'aws-cdk-lib';
import { AzureDevopsIamRunnerPipeline } from './pipeline/pipeline';
import { AzureDevopsBuildImage } from './pipeline/pipeline-build-image';
import { devEnv } from './shared/ap-southeast-1/environment';

const app = new App();

new AzureDevopsIamRunnerPipeline(app, 'azure-devops-iam-user', {
  env: devEnv,
});

new AzureDevopsBuildImage(app, 'azure-devops-build-image', devEnv, {
  env: devEnv,
});

app.synth();

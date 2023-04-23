import { awscdk } from 'projen';
import { UpdateSnapshot } from 'projen/lib/javascript';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.74.0',
  defaultReleaseBranch: 'master',
  name: 'azure-devops-iam-user',
  projenrcTs: true,
  deps: ['cdk-nag', 'env-var', 'dotenv', '@aws-cdk/aws-lambda-python-alpha'],
  jestOptions: {
    updateSnapshot: UpdateSnapshot.NEVER,
  },
});

project.gitignore.addPatterns('node_modules');
project.synth();

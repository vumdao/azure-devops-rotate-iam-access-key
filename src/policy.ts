export const AzureDevopsIamRunnerPolicyDocument = () => {
  const ECRReadStatement = {
    Effect: 'Allow',
    Sid: 'ECRRead',
    Action: ['ecr:Describe*', 'ecr:List*', 'ecr:GetAuthorizationToken'],
    Resource: ['*'],
  };

  const ECRPowerStatement = {
    Effect: 'Allow',
    Sid: 'ECRRegistryPower',
    Action: [
      'ecr:BatchGetImage',
      'ecr:BatchCheckLayerAvailability',
      'ecr:CompleteLayerUpload',
      'ecr:GetDownloadUrlForLayer',
      'ecr:InitiateLayerUpload',
      'ecr:PutImage',
      'ecr:UploadLayerPart',
    ],
    Resource: ['*'],
  };

  const s3ListStatement = {
    Effect: 'Allow',
    Action: ['s3:ListBucket'],
    Resource: ['*'],
  };

  const cloudfrontInvalidationStatement = {
    Effect: 'Allow',
    Sid: 'CloudfrontInvalidation',
    Action: [
      'cloudfront:CreateInvalidation',
      'cloudfront:GetInvalidation'
    ],
    Resource: ['*'],
  };

  const cloudfrontList = {
    Effect: 'Allow',
    Sid: 'ListCDN',
    Action: [
      "cloudfront:ListDistributions"
    ],
    Resource: ['*'],
  }

  return {
    Version: '2012-10-17',
    Statement: [
      ECRReadStatement,
      ECRPowerStatement,
      s3ListStatement,
      cloudfrontInvalidationStatement,
      cloudfrontList,
    ],
  };
};

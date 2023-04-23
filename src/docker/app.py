import subprocess
import boto3
import os

# Logging configuration
import logging
log = logging.getLogger()
log.setLevel(logging.INFO)
AZURE_SVC_NAME = os.getenv('AZURE_SVC_NAME')


def get_secret():
    secret_name = os.getenv('AWS_SECRET_NAME')

    # Create a Secrets Manager client
    client = boto3.client('secretsmanager', region_name='ap-southeast-1')
    try:
        log.info("Get secret credential")
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name)

        # Decrypts secret using the associated KMS key.
        secret = get_secret_value_response['SecretString']
        return True, secret
    except Exception as error:
        log.error(f"Failed to get secret credential, error: {error}")
        return False, f'Failed to get secret credential, error: {error}'


def get_ssm_pat():
    try:
        log.info("Get PAT token")
        aws_ssm_pat = os.getenv('AWS_AZURE_DEVOPS_SSM_PAT')
        aws_region = os.getenv('AWS_REGION')
        ssm = boto3.client('ssm', region_name=aws_region)
        pat_token = ssm.get_parameter(
            Name=aws_ssm_pat, WithDecryption=True)['Parameter']['Value'].strip()
        return True, pat_token
    except Exception as error:
        log.error(f"Failed to get PAT token, error: {error}")
        return False, f'Failed to get PAT token, error: {error}'


def handler(event, context):
    status, _pat = get_ssm_pat()
    if status:
        res, cred = get_secret()
        if not res:
            return {'Status': False, 'Log': f'Failed to get secret credential, error: {cred}'}
        access_key = event['AccessKey']
        try:
            subprocess.check_call(
                f"export AZURE_DEVOPS_EXT_PAT={_pat}; ./run.sh {access_key} {cred}", shell=True)
            return {'Status': True, 'Log': f'Succeed to create service endpoint {AZURE_SVC_NAME}'}
        except subprocess.CalledProcessError as error:
            log.error(f"Failed to create service endpoint, error: {error}")
            return {'Status': False, 'Log': f'Failed to create service endpoint, error: {error}'}
    else:
        return {'Status': False, 'Log': f'Failed to create service endpoint, error: {_pat}'}

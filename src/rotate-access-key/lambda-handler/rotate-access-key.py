import boto3
import os

# Logging configuration
import logging
log = logging.getLogger()
log.setLevel(logging.INFO)

# IAM User
IAM_USER_NAME = os.getenv('IAM_USER_NAME')
SECRET_NAME = os.getenv('AWS_SCM_NAME')

STATUS = False
ACCESS_KEY = None
CRED_KEY = ''
LOG = 'Succeed to rotate access key'


def handler(event, context):
    """Handler for Lambda.
    :param event: action to call functions
    """
    global STATUS
    STATUS = create_new_key()
    if STATUS:
        STATUS = update_secret_manager()
        if STATUS:
            STATUS = delete_old_key()
    return {'Status': STATUS, 'AccessKey': ACCESS_KEY, 'Log': LOG}


def create_new_key():
    try:
        log.info("Create new Access Key")
        global ACCESS_KEY, CRED_KEY, LOG
        iam_client = boto3.client('iam')
        access_key_metadata = iam_client.create_access_key(
            UserName=IAM_USER_NAME)
        ACCESS_KEY = access_key_metadata['AccessKey']['AccessKeyId']
        CRED_KEY = access_key_metadata['AccessKey']['SecretAccessKey']
        return True
    except Exception as error:
        LOG = f'Rotate access key failed error: {error}'
        log.error(LOG)
        return False


def delete_old_key():
    """
      - Get list of AWS Access key ID
      - Deactivate if key not the latest_key and then delete the key
    """
    if ACCESS_KEY is None:
        log.info("There's no old key to delete")
        return True

    try:
        global LOG
        iam_client = boto3.client('iam')
        keydetails = iam_client.list_access_keys(UserName=IAM_USER_NAME)
        for keys in keydetails['AccessKeyMetadata']:
            access_key_id = keys['AccessKeyId']
            if access_key_id == ACCESS_KEY:
                continue
            else:
                log.info(f"Delete old key {access_key_id}")
                iam_client.update_access_key(UserName=IAM_USER_NAME,
                                             AccessKeyId=access_key_id,
                                             Status='Inactive')
                iam_client.delete_access_key(UserName=IAM_USER_NAME,
                                             AccessKeyId=access_key_id)
        return True
    except Exception as error:
        LOG = f'Delete old key got error: {error}'
        log.error(LOG)
        return False


def update_secret_manager():
    try:
        log.info("Update secret manager")
        global LOG
        sm_client = boto3.client('secretsmanager')
        sm_client.put_secret_value(SecretId=SECRET_NAME,
                                   SecretString=CRED_KEY)
        return True
    except Exception as error:
        LOG = f'Update secret manager failed, error: {error}'
        log.error(LOG)
        return False

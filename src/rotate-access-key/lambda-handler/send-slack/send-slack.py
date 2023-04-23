import boto3
import requests
from datetime import datetime
import json
import os


def send_slack(msg, is_success):
    """ Send alarm to slack """
    if is_success:
        color = '#2EB67D'
        level = ':white_check_mark: INFO :white_check_mark:'
    else:
        color = '#750202'
        level = ':boom: ALERT :boom:'
    ssm = boto3.client('ssm')
    slack_url_ssm = os.getenv('AWS_SLACK_WEBHOOK_URL_SSM')
    webhook_url = ssm.get_parameter(
        Name=slack_url_ssm, WithDecryption=True)['Parameter']['Value'].strip()
    footer_icon = 'https://cdn.joypixels.com/emoji/emojione/2.0/1f6a8.svg'
    curr_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    slack_payload = {"username": "AzureDevops-Rotate-Access-Key",
                     "attachments": [{"fallback": "Required plain-text summary of the attachment.",
                                      "pretext": level,
                                      "color": color,
                                      "text": msg,
                                      "footer": curr_time,
                                      "footer_icon": footer_icon}]}
    requests.post(webhook_url, data=json.dumps(slack_payload),
                  headers={'Content-Type': 'application/json'})


def handler(event, context):
    message = event['Log']
    flag = event['Status']
    send_slack(message, flag)

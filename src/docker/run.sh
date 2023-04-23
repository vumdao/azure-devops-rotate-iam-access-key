#!/bin/bash -e

# Get old service ID
echo "Get old service ID"
svc_id=$(az devops service-endpoint list -p ${PROJ_ID} --organization ${ORG} | jq ".[] | select(.serviceEndpointProjectReferences[0].name == \"${AZURE_SVC_NAME}\") | .id" | sed 's/"//g')
echo "old service ID $svc_id"

# Delete service connection
if [ "X$svc_id" != "X" ]; then
  echo "Delete service connection ID ${svc_id}"
  az devops service-endpoint delete --id ${svc_id} -p ${PROJ_ID} --organization ${ORG} -y
fi

# Generate data JSON file
echo "Generate data JSON file"
cat <<EOF >/tmp/aws-svc-connection.json
{
  "data": {},
  "name": "${AZURE_SVC_NAME}",
  "type": "AWS",
  "url": "https://aws.amazon.com/",
  "authorization": {
    "parameters": {
      "assumeRoleArn": "arn:aws:iam::${AWS_ACCOUNT}:role/${AWS_ROLE_NAME}",
      "externalId": "",
      "password": "${2}",
      "roleSessionName": "azure-devops-pipeline",
      "sessionToken": null,
      "username": "${1}"
    },
    "scheme": "UsernamePassword"
  },
  "isShared": false,
  "isReady": true,
  "serviceEndpointProjectReferences": [
    {
      "projectReference": {
        "id": "${PROJ_ID}",
        "name": "${PROJ_NAME}"
      },
      "name": "${AZURE_SVC_NAME}"
    }
  ]
}
EOF

# Create service
echo "Create service endpoint"
az devops service-endpoint create --service-endpoint-configuration /tmp/aws-svc-connection.json -p ${PROJ_ID} --organization ${ORG}

# Get service ID to update
echo "Update service endpoint"
svc_id=$(az devops service-endpoint list -p ${PROJ_ID} --organization ${ORG} | jq ".[] | select(.serviceEndpointProjectReferences[0].name == \"${AZURE_SVC_NAME}\") | .id" | sed 's/"//g')
az devops service-endpoint update --id ${svc_id} -p ${PROJ_ID} --organization ${ORG} --enable-for-all true

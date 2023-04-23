FROM public.ecr.aws/lambda/python:3.10

ENV AZURE_CONFIG_DIR=/tmp

ENV AZURE_EXTENSION_DIR=${LAMBDA_TASK_ROOT}

ENV AZURE_DEVOPS_CACHE_DIR=/tmp

RUN pip3 install --no-dependencies azure-cli==2.40.0 --target /tmp/azurecli && \
    pip3 install azure-cli-core --target /tmp/azure-core && \
    pip3 install azure-common --target /tmp/azure-common && \
    pip3 install azure-mgmt-compute --target /tmp/azure-mgmt-compute && \
    pip3 install azure-mgmt-monitor --target /tmp/azure-mgmt-monitor && \
    pip3 install azure-mgmt-resource --target /tmp/azure-mgmt-resource && \
    pip3 install semver --target "${LAMBDA_TASK_ROOT}"

RUN cp -r /tmp/azurecli/* ${LAMBDA_TASK_ROOT}/ && \
    cp -r /tmp/azure-core/* ${LAMBDA_TASK_ROOT}/ && \
    cp -r /tmp/azure-common/* ${LAMBDA_TASK_ROOT}/ && \
    cp -r /tmp/azure-mgmt-compute/* ${LAMBDA_TASK_ROOT}/ && \
    cp -r /tmp/azure-mgmt-monitor/* ${LAMBDA_TASK_ROOT}/ && \
    cp -r /tmp/azure-mgmt-resource/* ${LAMBDA_TASK_ROOT}/ && \
    rm -r /tmp/azure*

RUN cp ${LAMBDA_TASK_ROOT}/bin/az /usr/bin/ && \
    az extension add -n azure-devops

RUN yum install -y jq && \
    rm -rf /var/cache/yum

COPY app.py ${LAMBDA_TASK_ROOT}
COPY run.sh ${LAMBDA_TASK_ROOT}

RUN chmod +x ${LAMBDA_TASK_ROOT}/run.sh

CMD [ "app.handler" ]
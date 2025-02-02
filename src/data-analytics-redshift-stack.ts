/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import {
  CfnCondition,
  CfnOutput,
  CfnStack,
  Fn,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RedshiftAnalyticsStack } from './analytics/analytics-on-redshift';
import {
  createStackParameters, RedshiftAnalyticsStackProps,
} from './analytics/parameter';
import { addCfnNagForCfnResource, addCfnNagForCustomResourceProvider, ruleRolePolicyWithWildcardResources } from './common/cfn-nag';
import {
  OUTPUT_DATA_MODELING_REDSHIFT_BI_USER_CREDENTIAL_PARAMETER_SUFFIX,
  OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_NAMESPACE_NAME,
  OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_ENDPOINT_ADDRESS,
  OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_ENDPOINT_PORT,
  OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_NAME,
} from './common/constant';
import { SolutionInfo } from './common/solution-info';
import { REDSHIFT_MODE } from '../src/common/model';

export class DataAnalyticsRedshiftStack extends Stack {
  public readonly nestedStacks: {
    readonly redshiftServerlessStack: RedshiftAnalyticsStack;
    readonly redshiftProvisionedStack: RedshiftAnalyticsStack;
    readonly newRedshiftServerlessStack: RedshiftAnalyticsStack;
  };
  constructor(
    scope: Construct,
    id: string,
    props?: StackProps,
  ) {
    super(scope, id, props);

    const featureName = 'Analytics';
    this.templateOptions.description = `(${SolutionInfo.SOLUTION_ID}-dmr) ${SolutionInfo.SOLUTION_NAME} - ${featureName} ${SolutionInfo.SOLUTION_VERSION_DETAIL}`;

    const p = createStackParameters(this);
    this.templateOptions.metadata = p.metadata;

    this.nestedStacks = createRedshiftAnalyticsStack(this, p.params);

    addCfnNagForCfnResource(this, 'CDK built-in custom resource for S3 bucket notification', 'BucketNotificationsHandler[0-9a-fA-F]+',
      undefined, [ruleRolePolicyWithWildcardResources('BucketNotificationsHandler[0-9a-fA-F]+/Role/DefaultPolicy/Resource', 'CDK built-in BucketNotification', 's3')]);

    addCfnNagForCustomResourceProvider(this.nestedStacks.newRedshiftServerlessStack, 'GetInterval', 'dataProcessGetIntervalCustomResourceProvider', '');
    addCfnNagForCustomResourceProvider(this.nestedStacks.redshiftProvisionedStack, 'GetInterval', 'dataProcessGetIntervalCustomResourceProvider', '');
    addCfnNagForCustomResourceProvider(this.nestedStacks.redshiftServerlessStack, 'GetInterval', 'dataProcessGetIntervalCustomResourceProvider', '');

    addCfnNagForCustomResourceProvider(this.nestedStacks.newRedshiftServerlessStack, 'upsertUsersGetInterval', 'upsertUsersGetIntervalCustomResourceProvider', '');
    addCfnNagForCustomResourceProvider(this.nestedStacks.redshiftProvisionedStack, 'upsertUsersGetInterval', 'upsertUsersGetIntervalCustomResourceProvider', '');
    addCfnNagForCustomResourceProvider(this.nestedStacks.redshiftServerlessStack, 'upsertUsersGetInterval', 'upsertUsersGetIntervalCustomResourceProvider', '');
  }
}

export function createRedshiftAnalyticsStack(
  scope: Construct,
  props: RedshiftAnalyticsStackProps,
) {
  const nestStackProps = {
    vpc: props.network.vpc,
    subnetSelection: props.network.subnetSelection,
    projectId: props.projectId,
    appIds: props.appIds,
    dataProcessingCronOrRateExpression: props.dataProcessingCronOrRateExpression,
    odsSource: {
      s3Bucket: props.odsEvents.bucket,
      prefix: props.odsEvents.prefix,
      fileSuffix: props.odsEvents.fileSuffix,
    },
    loadWorkflowData: {
      s3Bucket: props.loadConfiguration.workdir.bucket,
      prefix: props.loadConfiguration.workdir.prefix,
    },
    loadDataProps: {
      scheduleInterval: props.loadConfiguration.loadJobScheduleIntervalInMinutes,
      maxFilesLimit: props.loadConfiguration.maxFilesLimit,
      processingFilesLimit: props.loadConfiguration.processingFilesLimit,
    },
    upsertUsersWorkflowData: {
      scheduleExpression: props.upsertUsersConfiguration.scheduleExpression,
    },
    clearExpiredEventsWorkflowData: {
      scheduleExpression: props.clearExpiredEventsConfiguration.scheduleExpression,
      retentionRangeDays: props.clearExpiredEventsConfiguration.retentionRangeDays,
    },
  };

  props.odsEvents.bucket.enableEventBridgeNotification();

  const redshiftModeStr = props.redshift.mode;

  const isNewRedshiftServerless = new CfnCondition(
    scope,
    'newRedshiftServerless',
    {
      expression:
        Fn.conditionEquals(redshiftModeStr, REDSHIFT_MODE.NEW_SERVERLESS),
    },
  );
  const isExistingRedshiftServerless = new CfnCondition(
    scope,
    'existingRedshiftServerless',
    {
      expression:
        Fn.conditionEquals(redshiftModeStr, REDSHIFT_MODE.SERVERLESS),
    },
  );
  const isRedshiftProvisioned = new CfnCondition(
    scope,
    'redshiftProvisioned',
    {
      expression:
        Fn.conditionEquals(redshiftModeStr, REDSHIFT_MODE.PROVISIONED),
    },
  );

  const newRedshiftServerlessStack = new RedshiftAnalyticsStack(
    scope,
    REDSHIFT_MODE.NEW_SERVERLESS + ' Redshift',
    {
      ...nestStackProps,
      newRedshiftServerlessProps: {
        ...props.redshift.newServerless!,
        databaseName: props.redshift.defaultDatabaseName,
      },
      emrServerlessApplicationId: props.odsEvents.emrServerlessApplicationId,
      dataProcessingCronOrRateExpression: props.dataProcessingCronOrRateExpression,
    },
  );
  (newRedshiftServerlessStack.nestedStackResource as CfnStack).cfnOptions.condition = isNewRedshiftServerless;

  const redshiftExistingServerlessStack = new RedshiftAnalyticsStack(
    scope,
    REDSHIFT_MODE.SERVERLESS + ' Redshift',
    {
      ...nestStackProps,
      existingRedshiftServerlessProps: {
        createdInStack: false,
        databaseName: props.redshift.defaultDatabaseName,
        ...props.redshift.existingServerless!,
        dataAPIRoleArn: props.redshift.existingServerless!.iamRole,
      },
      emrServerlessApplicationId: props.odsEvents.emrServerlessApplicationId,
      dataProcessingCronOrRateExpression: props.dataProcessingCronOrRateExpression,
    },
  );
  (redshiftExistingServerlessStack.nestedStackResource as CfnStack).cfnOptions.condition = isExistingRedshiftServerless;

  const redshiftProvisionedStack = new RedshiftAnalyticsStack(
    scope,
    REDSHIFT_MODE.PROVISIONED + ' Redshift',
    {
      ...nestStackProps,
      provisionedRedshiftProps: {
        databaseName: props.redshift.defaultDatabaseName,
        ...props.redshift.provisioned!,
      },
      emrServerlessApplicationId: props.odsEvents.emrServerlessApplicationId,
      dataProcessingCronOrRateExpression: props.dataProcessingCronOrRateExpression,
    },
  );
  (redshiftProvisionedStack.nestedStackResource as CfnStack).cfnOptions.condition = isRedshiftProvisioned;

  new CfnOutput(scope, OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_NAME, {
    value: newRedshiftServerlessStack.redshiftServerlessWorkgroup?.workgroup.attrWorkgroupWorkgroupName ?? '',
    description: 'Workgroup name of Redshift Serverless',
    condition: isNewRedshiftServerless,
  });
  new CfnOutput(scope, OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_ENDPOINT_ADDRESS, {
    value: newRedshiftServerlessStack.redshiftServerlessWorkgroup?.workgroup.attrWorkgroupEndpointAddress ?? '',
    description: 'Endpoint address of Redshift Serverless',
    condition: isNewRedshiftServerless,
  });
  new CfnOutput(scope, OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_WORKGROUP_ENDPOINT_PORT, {
    value: newRedshiftServerlessStack.redshiftServerlessWorkgroup?.workgroupPort ?? '5439',
    description: 'Endpoint port of Redshift Serverless',
    condition: isNewRedshiftServerless,
  });
  new CfnOutput(scope, OUTPUT_DATA_MODELING_REDSHIFT_SERVERLESS_NAMESPACE_NAME, {
    value: newRedshiftServerlessStack.redshiftServerlessWorkgroup?.workgroup.attrWorkgroupNamespaceName ?? '',
    description: 'Namespace name of Redshift Serverless',
    condition: isNewRedshiftServerless,
  });
  new CfnOutput(scope, `NewRedshiftServerless${OUTPUT_DATA_MODELING_REDSHIFT_BI_USER_CREDENTIAL_PARAMETER_SUFFIX}`, {
    value: newRedshiftServerlessStack.applicationSchema.redshiftBIUserParameter,
    description: 'Credential SSM parameter for BI user in Redshift',
    condition: isNewRedshiftServerless,
  });
  new CfnOutput(scope, `ExistingRedshiftServerless${OUTPUT_DATA_MODELING_REDSHIFT_BI_USER_CREDENTIAL_PARAMETER_SUFFIX}`, {
    value: redshiftExistingServerlessStack.applicationSchema.redshiftBIUserParameter,
    description: 'Credential SSM parameter for BI user in Redshift',
    condition: isExistingRedshiftServerless,
  });
  new CfnOutput(scope, `ProvisionedRedshift${OUTPUT_DATA_MODELING_REDSHIFT_BI_USER_CREDENTIAL_PARAMETER_SUFFIX}`, {
    value: redshiftProvisionedStack.applicationSchema.redshiftBIUserParameter,
    description: 'Credential SSM parameter for BI user in Redshift',
    condition: isRedshiftProvisioned,
  });
  return {
    redshiftServerlessStack: redshiftExistingServerlessStack,
    newRedshiftServerlessStack,
    redshiftProvisionedStack,
  };
}
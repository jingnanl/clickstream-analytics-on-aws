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
  Box,
  ColumnLayout,
  SpaceBetween,
  Link,
} from '@cloudscape-design/components';
import DomainNameWithStatus from 'pages/common/DomainNameWithStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProtocalType, SinkType } from 'ts/const';
import { buildMSKLink, buildS3Link, buildSubnetLink } from 'ts/url';

interface TabContentProps {
  pipelineInfo?: IExtPipeline;
}
const Ingestion: React.FC<TabContentProps> = (props: TabContentProps) => {
  const { pipelineInfo } = props;
  const { t } = useTranslation();

  const buildBufferDisplay = (pipelineInfo?: IExtPipeline) => {
    if (pipelineInfo?.ingestionServer.sinkType === SinkType.S3) {
      return (
        <div>
          S3 (
          <Link
            href={buildS3Link(
              pipelineInfo.region,
              pipelineInfo.ingestionServer.sinkS3.sinkBucket.name,
              pipelineInfo.ingestionServer.sinkS3.sinkBucket.prefix
            )}
            external
          >
            S3://{pipelineInfo.ingestionServer.sinkS3.sinkBucket.name}/
            {pipelineInfo.ingestionServer.sinkS3.sinkBucket.prefix}
          </Link>
          )
        </div>
      );
    }
    if (pipelineInfo?.ingestionServer.sinkType === SinkType.KDS) {
      return `KDS (${pipelineInfo.ingestionServer.sinkKinesis.kinesisStreamMode})`;
    }
    // review and launch page
    if (!pipelineInfo?.pipelineId) {
      // self hosted kafka
      if (pipelineInfo?.ingestionServer.sinkType === SinkType.MSK) {
        if (pipelineInfo?.kafkaSelfHost) {
          return `Kafka (${pipelineInfo.ingestionServer.sinkKafka.brokers.join(
            ','
          )})`;
        } else {
          return (
            <div>
              MSK (
              <Link
                href={buildMSKLink(
                  pipelineInfo.region,
                  encodeURIComponent(
                    pipelineInfo.ingestionServer.sinkKafka.mskCluster.arn
                  )
                )}
                external
              >
                {pipelineInfo?.ingestionServer.sinkKafka.mskCluster.name}
              </Link>
              )
            </div>
          );
        }
      }
    } else {
      // pipeline detail page
      if (pipelineInfo?.ingestionServer.sinkType === SinkType.MSK) {
        if (pipelineInfo?.ingestionServer.sinkKafka.mskCluster) {
          return (
            <div>
              MSK (
              <Link
                href={buildMSKLink(
                  pipelineInfo.region,
                  encodeURIComponent(
                    pipelineInfo.ingestionServer.sinkKafka.mskCluster.arn
                  )
                )}
                external
              >
                {pipelineInfo?.ingestionServer.sinkKafka.mskCluster.name}
              </Link>
              )
            </div>
          );
        } else {
          return `Kafka (${pipelineInfo.ingestionServer.sinkKafka.brokers.join(
            ','
          )})`;
        }
      }
    }
    return '-';
  };

  return (
    <ColumnLayout columns={3} variant="text-grid">
      <SpaceBetween direction="vertical" size="l">
        <div>
          <Box variant="awsui-key-label">
            {t('pipeline:detail.publicSubnet')}
          </Box>
          <div>
            {pipelineInfo?.network?.publicSubnetIds?.map((element) => {
              return (
                <div key={element}>
                  <Link
                    external
                    href={buildSubnetLink(pipelineInfo.region || '', element)}
                  >
                    {element}
                  </Link>
                </div>
              );
            }) || '-'}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">
            {t('pipeline:detail.privateSubnet')}
          </Box>
          <div>
            {pipelineInfo?.network?.privateSubnetIds?.map((element) => {
              return (
                <div key={element}>
                  <Link
                    external
                    href={buildSubnetLink(pipelineInfo.region || '', element)}
                  >
                    {element}
                  </Link>
                </div>
              );
            }) || '-'}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">
            {t('pipeline:detail.ingestionCapacity')}
          </Box>
          <div>
            {`${t('pipeline:detail.min')}:${
              pipelineInfo?.ingestionServer.size.serverMin
            }, 
              ${t('pipeline:detail.max')}:${
              pipelineInfo?.ingestionServer.size.serverMax
            }, 
              ${t('pipeline:detail.warm')}:${
              pipelineInfo?.ingestionServer.size.warmPoolSize
            }`}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">
            {t('pipeline:detail.enableHTTPS')}
          </Box>
          <div>
            {pipelineInfo?.ingestionServer.loadBalancer.protocol ===
            ProtocalType.HTTPS
              ? t('yes')
              : t('no')}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">{t('pipeline:detail.acm')}</Box>
          <div>
            {pipelineInfo?.ingestionServer.domain.certificateArn || '-'}
          </div>
        </div>
      </SpaceBetween>

      <SpaceBetween direction="vertical" size="l">
        <div>
          <Box variant="awsui-key-label">{t('pipeline:detail.domainName')}</Box>
          <DomainNameWithStatus
            type="domain"
            projectId={pipelineInfo?.projectId}
            pipelineId={pipelineInfo?.pipelineId}
            customDomain={pipelineInfo?.ingestionServer.domain.domainName}
            fetch={pipelineInfo?.pipelineId ? true : false}
          />
        </div>

        {pipelineInfo?.pipelineId && (
          <>
            <div>
              <Box variant="awsui-key-label">{t('pipeline:detail.dns')}</Box>
              <DomainNameWithStatus
                type="dns"
                projectId={pipelineInfo?.projectId}
                pipelineId={pipelineInfo?.pipelineId}
                dns={pipelineInfo?.dns}
                fetch={false}
              />
            </div>

            <div>
              <Box variant="awsui-key-label">
                {t('pipeline:detail.endpoint')}
              </Box>
              <DomainNameWithStatus
                type="endpoint"
                projectId={pipelineInfo?.projectId}
                pipelineId={pipelineInfo?.pipelineId}
                endpoint={pipelineInfo?.endpoint}
                fetch={pipelineInfo?.pipelineId ? true : false}
              />
            </div>
          </>
        )}

        <div>
          <Box variant="awsui-key-label">{t('pipeline:detail.enableAGA')}</Box>
          <div>
            {pipelineInfo?.ingestionServer.loadBalancer.enableGlobalAccelerator
              ? t('yes')
              : t('no')}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">{t('pipeline:detail.enableAuth')}</Box>
          <div>
            {pipelineInfo?.ingestionServer.loadBalancer.authenticationSecretArn
              ? t('yes')
              : t('no')}
          </div>
        </div>

        <div>
          <Box variant="awsui-key-label">
            {t('pipeline:detail.enableALBLog')}
          </Box>
          <div>
            {pipelineInfo?.ingestionServer.loadBalancer
              .enableApplicationLoadBalancerAccessLog
              ? t('yes')
              : t('no')}
          </div>
        </div>
      </SpaceBetween>

      <SpaceBetween direction="vertical" size="l">
        <div>
          <Box variant="awsui-key-label">{t('pipeline:detail.dataBuffer')}</Box>
          <div>{buildBufferDisplay(pipelineInfo)}</div>
        </div>

        {pipelineInfo?.ingestionServer.sinkType === SinkType.S3 && (
          <>
            <div>
              <Box variant="awsui-key-label">
                {t('pipeline:detail.bufferSize')}
              </Box>
              <div>
                <div>
                  {pipelineInfo.ingestionServer.sinkS3.s3BufferSize || '-'}
                </div>
              </div>
            </div>
            <div>
              <Box variant="awsui-key-label">
                {t('pipeline:detail.bufferInterval')}
              </Box>
              <div>
                <div>
                  {pipelineInfo.ingestionServer.sinkS3.s3BufferInterval || '-'}
                </div>
              </div>
            </div>
          </>
        )}

        {pipelineInfo?.ingestionServer.sinkType === SinkType.MSK && (
          <div>
            <Box variant="awsui-key-label">{t('pipeline:detail.topic')}</Box>
            <div>
              <div>{pipelineInfo.ingestionServer.sinkKafka.topic || '-'}</div>
            </div>
          </div>
        )}

        {(pipelineInfo?.ingestionServer.sinkType === SinkType.KDS ||
          pipelineInfo?.ingestionServer.sinkType === SinkType.MSK) && (
          <>
            <div>
              <Box variant="awsui-key-label">
                {t('pipeline:create.sinkMaxInterval')}
              </Box>
              <div>
                {pipelineInfo?.ingestionServer?.sinkBatch?.intervalSeconds}
              </div>
            </div>

            <div>
              <Box variant="awsui-key-label">
                {t('pipeline:create.sinkBatchSize')}
              </Box>
              <div>{pipelineInfo?.ingestionServer?.sinkBatch?.size}</div>
            </div>
          </>
        )}
      </SpaceBetween>
    </ColumnLayout>
  );
};

export default Ingestion;

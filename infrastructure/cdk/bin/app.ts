#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BeefmobileStack } from '../lib/beefmobile-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

new BeefmobileStack(app, `BeefmobileStack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment,
  tags: {
    Project: 'Beefmobile',
    Environment: environment,
    ManagedBy: 'CDK',
  },
});

'use strict';

const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
const tableName = 'Subscription';

module.exports.webhook = async (event) => {
  console.log('running');

  if (!event.body) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const { data, type } = JSON.parse(event.body);

    switch (type) {
      case 'checkout.session.completed': return await checkoutSessionCompleted(data);
      case 'customer.updated': return await customerUpdated(data);
      case 'customer.created': return await customerCreated(data);
      case 'invoice.payment_failed': return await invoicePaymentFailed(data);
      case 'invoice.payment_succeeded': return await invoicePaymentSucceeded(data);
      case 'customer.subscription.deleted': return await customerSubscriptionDeleted(data);
      case 'customer.subscription.updated': return await customerSubscriptionUpdated(data);
      case 'customer.subscription.created': return await customerSubscriptionCreated(data);
      default: return await handleUnknownType(type, data);
    }
  } catch (error) {
    return getResponse(400, null, error);
  }
};

async function checkoutSessionCompleted(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function customerUpdated(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function customerCreated(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function invoicePaymentFailed(data) {
  // TODO: update dynamo

  // TODO: send out notification

  return getResponse(200, null, null);
}

async function invoicePaymentSucceeded(data) {
  // TODO: update dynamo

  // TODO: send out notification

  return getResponse(200, null, null);
}

async function customerSubscriptionDeleted(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function customerSubscriptionUpdated(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function customerSubscriptionCreated(data) {
  // TODO: update dynamo

  return getResponse(200, null, null);
}

async function handleUnknownType(type, data) {
  console.log('Event Type is not configured:', type);
  console.log(JSON.stringify(data));

  // TODO: send out notification

  return getResponse(200, null, null);
}

function getResponse(statusCode, body, error) {
  if (error) console.error(error);

  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'content-type': 'application/json'
    },
    body: body,
    error: error
  };
}

'use strict';

const stripeSecret = 'sk_test_51O3ObsJDvifNBMqnhYzPwcePEGfPf8ZvRIdkyt5r4l1QAKhliKFWhVeVYCzDiuui1W6HvvZX1DTn0oCsdpCDC5k100TwErhOon';
const stripe = require('stripe')(stripeSecret);
const AWS = require('aws-sdk');

module.exports.deleteStripeSubscription = async (event) => {
  console.log('running');

  if (!event.pathParameters?.id) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const subscriptionId = event.pathParameters.id;

    const subscription = await stripe.subscriptions.cancel(subscriptionId);

    return getResponse(200, JSON.stringify(subscription), null);
  } catch (error) {
    return getResponse(400, null, error);
  }
};

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

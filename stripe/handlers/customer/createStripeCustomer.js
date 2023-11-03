'use strict';

const stripeSecret = 'sk_test_51O3ObsJDvifNBMqnhYzPwcePEGfPf8ZvRIdkyt5r4l1QAKhliKFWhVeVYCzDiuui1W6HvvZX1DTn0oCsdpCDC5k100TwErhOon';
const stripe = require('stripe')(stripeSecret);
const AWS = require('aws-sdk');

module.exports.createStripeCustomer = async (event) => {
  console.log('running');

  if (!event.body) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const request = JSON.parse(event.body);

    validateRequest(request);

    const customer = await stripe.customers.create({
      description: 'customer',
      email: request.email,
      metadata: {
        userid: request.userId
      }
    });

    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      customer: customer.id
    });

    return getResponse(200, JSON.stringify({ customer, setupIntent }), null);
  } catch (error) {
    return getResponse(400, null, error);
  }
};

function validateRequest(request) {
  // TODO: validate more request properties
  var errors = [];

  if (!request.userId)
    errors.push('User Id is required.');

  if (!request.email)
    errors.push('Email is required.');

  if (errors.length)
    throw errors.join(' ');
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

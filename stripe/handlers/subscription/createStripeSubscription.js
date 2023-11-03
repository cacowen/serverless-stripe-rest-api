'use strict';

const stripeSecret = 'sk_test_51O3ObsJDvifNBMqnhYzPwcePEGfPf8ZvRIdkyt5r4l1QAKhliKFWhVeVYCzDiuui1W6HvvZX1DTn0oCsdpCDC5k100TwErhOon';
const stripe = require('stripe')(stripeSecret);
const AWS = require('aws-sdk');

module.exports.createStripeSubscription = async (event) => {
  console.log('running');

  if (!event.body) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const request = JSON.parse(event.body);

    // TODO: what does this do?
    await stripe.paymentMethods.attach(
      request.paymentMethodId,
      {
        customer: request.customerId
      }
    );

    // TODO: what does this do?
    let updateCustomerDefaultPaymentMethod = await stripe.customers.update(
      request.customerId,
      {
        invoice_settings: {
          default_payment_method:
            request.paymentMethodId
        }
      }
    );

    const subscriptions = await stripe.subscriptions.list({ customer: request.customerId, status: 'active' });

    // TODO: what does this do?
    if (subscriptions.data?.length) {
      const subscription = subscriptions.data[0];
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        {
          cancel_at_period_end: false,
          items: [
            {
              // id: subscription.items.data[0].id,
              price: request.planId
            }
          ]
        }
      );

      return getResponse(200, JSON.stringify(updatedSubscription), null);
    }

    const subscription = await stripe.subscriptions.create({
      customer: request.customerId,
      items: [{ plan: request.planId }],
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userid: request.customerId
      }
    });

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

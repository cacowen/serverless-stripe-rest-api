const { APIGatewayProxyEvent, APIGatewayProxyResult } = require("aws-lambda");
const stripeSecret = 'sk_test_51O3ObsJDvifNBMqnhYzPwcePEGfPf8ZvRIdkyt5r4l1QAKhliKFWhVeVYCzDiuui1W6HvvZX1DTn0oCsdpCDC5k100TwErhOon';
const stripe = require('stripe')(stripeSecret);

const { products } = require('./products')

const AWS = require("aws-sdk");
const { v4 } = require("uuid");
const yup = require("yup");

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "ProductsTable";
const headers = {
  "content-type": "application/json",
};

const schema = yup.object().shape({
  name: yup.string().required(),
  description: yup.string().required(),
  price: yup.number().required(),
  available: yup.bool().required(),
});

const createProduct = async (event) => {
  try {
    const reqBody = JSON.parse(event.body);

    await schema.validate(reqBody, { abortEarly: false });

    const product = {
      ...reqBody,
      productID: v4(),
    };

    await docClient
      .put({
        TableName: tableName,
        Item: product,
      })
      .promise();

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(product),
    };
  } catch (e) {
    return handleError(e);
  }
};

class HttpError extends Error {
  constructor(statusCode, body = {}) {
    super(JSON.stringify(body));
  }
}

const fetchProductById = async (id) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        productID: id,
      },
    })
    .promise();

  if (!output.Item) {
    throw new HttpError(404, { error: "not found" });
  }

  return output.Item;
};

const handleError = (e) => {
  return {
    statusCode: 400,
    headers,
    body: null,
    error: e
  }
};

const getProduct = async (event) => {
  try {
    const product = await fetchProductById(event.pathParameters?.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product),
    };
  } catch (e) {
    return handleError(e);
  }
};

const updateProduct = async (event) => {
  try {
    const id = event.pathParameters?.id;

    await fetchProductById(id);

    const reqBody = JSON.parse(event.body);

    await schema.validate(reqBody, { abortEarly: false });

    const product = {
      ...reqBody,
      productID: id,
    };

    await docClient
      .put({
        TableName: tableName,
        Item: product,
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product),
    };
  } catch (e) {
    return handleError(e);
  }
};

const deleteProduct = async (event) => {
  try {
    const id = event.pathParameters?.id;

    await fetchProductById(id);

    await docClient
      .delete({
        TableName: tableName,
        Key: {
          productID: id,
        },
      })
      .promise();

    return {
      statusCode: 204,
      body: "",
    };
  } catch (e) {
    return handleError(e);
  }
};

const listProduct = async (event) => {
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output.Items),
  };
};

const createStripeCustomer = async (event) => {
  event.body = JSON.parse(event.body)
  try {
    const customer = await stripe.customers.create({
      description: 'customer',
      email: event.body.email,
      metadata: {
        userid: event.body.userId
      }
    });
    // Create a SetupIntent to set up our payment methods recurring usage
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      customer: customer.id,
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ customer, setupIntent }, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const getStripeCustomer = async (event) => {
  // const output = await docClient
  //   .scan({
  //     TableName: tableName,
  //   })
  //   .promise();

  // return {
  //   statusCode: 200,
  //   headers,
  //   body: JSON.stringify(output.Items),
  // };
  try {
    const id = event.pathParameters?.id;
    const customer = await stripe.customers.retrieve(id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(customer, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const deleteStripeCustomer = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const deleted = await stripe.customers.del(
      id
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(deleted, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const createStripeSubscription = async (event) => {
  event.body = JSON.parse(event.body)
  try {
    await stripe.paymentMethods.attach(event.body.paymentMethodId, {
      customer: event.body.customerId,
    });

    let updateCustomerDefaultPaymentMethod = await stripe.customers.update(
      event.body.customerId,
      {
        invoice_settings: {
          default_payment_method: event.body.paymentMethodId,
        },
      }
    );

    const subscriptions = await stripe.subscriptions.list({ customer: event.body.customerId, status: 'active' })

    if (subscriptions.data && subscriptions.data.length) {
      const subscription = subscriptions.data[0]
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        {
          cancel_at_period_end: false,
          items: [
            {
              // id: subscription.items.data[0].id,
              price: event.body.planId,
            },
          ],
        }
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ updatedSubscription: updatedSubscription }, null, 4)
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: event.body.customerId,
      items: [{ plan: event.body.planId }],
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userid: event.body.customerId
      }
    });

    console.log('subscription - ', subscription)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(subscription, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const deleteStripeSubscription = async (event) => {
  event.body = JSON.parse(event.body)
  try {
    const id = event.pathParameters?.id;

    const subscription = await stripe.subscriptions.cancel(
      id,
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(subscription, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const stopOrRestartStripeSubscription = async (event) => {
  event.body = JSON.parse(event.body)
  try {
    const id = event.pathParameters?.id;

    const subscription = await stripe.subscriptions.update(
      id,
      { cancel_at_period_end: event.body.cancel }
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(subscription, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const getStripeSubscription = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const subscription = await stripe.subscriptions.retrieve(
      id
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(subscription, null, 4)
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const createStripeCheckout = async (event) => {
  event.body = JSON.parse(event.body)

  // if customer paid by checkout url process then need to cancle or delete current active subscription so user will have only one subscription 
  // or we can use subscription create method to merge stripe both subscriptions
  try {
    const data = {
      customer: event.body.customerId,
      success_url: event.body.success_url,
      line_items: [
        { price: event.body.priceId, quantity: 1 },
      ],
      mode: 'subscription',
    }
    const session = await stripe.checkout.sessions.create(data);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(session, null, 4)
    }
  } catch (error) {
    console.log(error.message)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

const addOrUpdatePaymentMethod = async (event) => {
  // need to get payment method id from frontend when card verification proceed by stripe element
  // frontend have a method to create payment method from card element 
  // so we will get payment method from frontend then need to call this route so newly created method will be attched to customer

  event.body = JSON.parse(event.body)
  try {
    try {
      await stripe.paymentMethods.attach(
        event.pathParameters.id,
        {
          customer: event.body.customerId,
        }
      );
    } catch (error) {
      console.log('payment method attached error due to already payment method attached!! - ', error)
    }
    const customerDetails = await stripe.customers.update(
      event.body.customerId,
      {
        invoice_settings: {
          default_payment_method: event.pathParameters.id,
        },
      }
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(customerDetails, null, 4)
    }
  } catch (error) {
    // in case card_decline error
    console.log(error.message)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }

  const invoice = await stripe.invoices.retrieve(event.body.invoiceId, {
    expand: ['payment_intent'],
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(invoice, null, 4)
  }
}


const upcomingInvoices = async (event) => {
  try {
    event.body = JSON.parse(event.body);
    const subscription = await stripe.subscriptions.retrieve(
      event.body.subscriptionId
    );

    const invoice = await stripe.invoices.retrieveUpcoming({
      // subscription_prorate: true,
      customer: event.body.customerId,
      subscription: event.body.subscriptionId,
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(invoice, null, 4)
    }
  } catch (error) {
    console.log(error.message)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
}

const upgradeOrDownGradeSubscription = async (event) => {
  try {
    event.body = JSON.parse(event.body);
    const subscription = await stripe.subscriptions.retrieve(
      event.pathParameters.id
    );
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: false,
        items: [
          {
            id: subscription.items.data[0].id,
            price: event.body.priceId,
          },
        ],
      }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updatedSubscription, null, 4)
    }
  } catch (error) {
    console.log(error.message)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
}


const retriveCustomerPaymentMethod = async (event) => {
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(
      event.pathParameters.id
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(paymentMethod, null, 4)
    }
  } catch (error) {
    console.log(error.message)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
}

// M.A : This is basically a clone of handleSuccess function , but with a couple of changes
const handlePaymentSuccess = async (
  id,
  customer_id,
  subscription_id
) => {

  // Initialize start_date and end_date
  let start_date = undefined;
  let end_date = undefined;

  /** Retrive stripe subscription */
  let stripeSubscriptionDetails;
  try {
    stripeSubscriptionDetails = await stripe.subscriptions.retrieve(
      subscription_id
    );

    if (stripeSubscriptionDetails.id) {
      start_date = new Date(stripeSubscriptionDetails.current_period_start * 1000);
      end_date = new Date(stripeSubscriptionDetails.current_period_end * 1000);
    }

    if (stripeSubscriptionDetails.default_payment_method) {
      // set customer's default payment method
      await stripe.customers.update(customer_id, {
        invoice_settings: {
          default_payment_method:
            stripeSubscriptionDetails?.default_payment_method,
        },
      });
    }

    // update user subscription in database
    // await Subscription.update(
    //   {
    //     stripe_subscription_id: subscription_id,
    //     start_date,
    //     end_date,
    //   },
    //   { where: { user_id: id } }
    // );

    // let subscription = await Subscription.findOne({
    //   where: { user_id: id },
    //   order: [["createdAt", "DESC"]],
    //   raw: true,
    // });

    // const plans = await Plan.findOne({
    //   where: { id: subscription?.plan_id },
    // });

    // /** Update user details into database */
    // await User.update(
    //   {
    //     stripe_customer_id: customer_id,
    //     current_plan_id: subscription?.plan_id,
    //     subscription_id: subscription.id,
    //     usage: {
    //       pages: plans.pages,
    //       queries: plans.query,
    //       size: plans.size,
    //     },
    //   },
    //   { where: { id } }
    // );

    // const user = await User.findOne({
    //   where: { id: id },
    //   include: [Subscription, Plan],
    // });
    // user.daysAfterRemoveDocs = getHistoryDaysByPlan(user.Plan.name);
    // user.save();
  } catch (error) {
    console.log("Error in handlePaymentSuccess :", error)
    /** Handle retrive stripe subscription error */
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify(error, null, 4)
    }
  }
};

const webhook = async (event) => {
  event.body = JSON.parse(event.body)
  try {

    let data;

    let eventType;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      let event;
      // let signature = req.headers["stripe-signature"];
      // console.log("hi", req.rawBody);

      // try {
      //   event = stripe.webhooks.constructEvent(
      //     event.rawBody,
      //     signature ?? "",
      //     webhookSecret
      //   );
      // } catch (err) {
      //   // return res.status(400).send(err);
      // }
      data = event.body.data;
      eventType = event.body.type;
    } else {
      data = event.body.data;
      eventType = event.body.type;
    }

    const handlePayment = async (data, eventType) => {
      try {
        console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
        // calculate for subscription update and add login to update usage
        // "billing_reason": "subscription_update",

        await handlePaymentSuccess(
          data.object.metadata.userid,
          data.object.customer,
          data.object.id
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: "Success",
            message: `billing_reason: ${data.object.billing_reason}, User:${data.object.customer} :  Success`,
          }, null, 4)
        }
      } catch (error) {
        console.log(`\n Error:billing_reason: ${data.object.billing_reason}, User:${data.object.customer}  `, error)
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: "Failed",
            message: `billing_reason: ${data.object.billing_reason}, User:${data.object.customer}:  failed`,
            error
          }, null, 4)
        }
      }
    }

    switch (eventType) {
      case "checkout.session.completed":
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
      case "customer.created":
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
      case "invoice.paid":
        await handlePayment(data, eventType)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
      case "invoice.payment_failed":

        console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
        // console.log("🚀 ~ file: subscription.controller.ts:575 ~ webhook ~ data.object.billing_reason ==:", data.object.billing_reason == "subscription_cycle")
        try {
          console.log("🚀 ~ file: subscription.controller.ts:490 ~ webhook ~ data.object.billing_reason:", data.object.billing_reason == "subscription_cycle")
          console.log("🚀 ~ file: subscription.controller.ts:502 ~ webhook ~ data.object.metadata.userid:", data.object.subscription_details.metadata.userid)
          if (data.object.billing_reason == "subscription_cycle") {
            // revoke user usage in database if required like below
            //   await User.update(
            //     {
            //       current_plan_id: 1,
            //       usage: {
            //         pages: 0,
            //         queries: 0,
            //         size: 1,
            //       },
            //     },
            //     {
            //       where: { id: data.object.subscription_details.metadata.userid },
            //       returning: true,
            //     }
            //   );
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({}, null, 4)
          }

        } catch (err) {
          console.log("Error in payment failed evenr:", err)
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify(error, null, 4)
          }
        }
        break;

      case "invoice.payment_succeeded":
        await handlePayment(data, eventType)
        break;

      case "customer.subscription.deleted":
        console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
        // This Event is used to reset usage in USER table and Deleting subscription from Subscription table
        const userid = data.object.metadata.userid;

        const deactiveStatus = ["canceled", "ended"];

        try {
          if (deactiveStatus.includes(data.object.status)) {
            // update user useage like below
            // let UpdatedUser = await User.update(
            //   {
            //     current_plan_id: 1,
            //     usage: {
            //       pages: 0,
            //       queries: 0,
            //       size: 1,
            //     },
            //   },
            //   {
            //     where: { id: userid },
            //     returning: true,
            //   }
            // );

            // let subscription_id = UpdatedUser[1][0]?.dataValues?.subscription_id

            // if (subscription_id)
            //   Subscription.destroy({ where: { id: subscription_id } });
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({}, null, 4)
          }

        } catch (error) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify(error, null, 4)
          }
        }
        break;

      case "customer.subscription.updated":
        console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
        break;

      case 'customer.subscription.created':
        const customerSubscriptionCreated = data;
        await handlePayment(data, eventType)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
        // Then define and call a function to handle the event customer.subscription.created
        break;
      default:
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({}, null, 4)
        }
        break;
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({}, null, 4)
    }

  } catch (error) {
    console.log(error)
    return {
      statusCode: 400,
      headers,
      body: null,
      error: error
    }
  }
};

module.exports = {
  createProduct,
  deleteProduct,
  fetchProductById,
  listProduct,
  updateProduct,
  stopOrRestartStripeSubscription,
  createStripeCustomer,
  createStripeSubscription,
  deleteStripeCustomer,
  getStripeSubscription,
  getStripeCustomer,
  createStripeCheckout,
  addOrUpdatePaymentMethod,
  upcomingInvoices,
  upgradeOrDownGradeSubscription,
  retriveCustomerPaymentMethod,
  webhook,
  deleteStripeSubscription
}
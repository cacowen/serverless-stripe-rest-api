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
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `invalid request body format : "${e.message}"` }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }

  throw e;
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

    const subscription = await stripe.subscriptions.create({
      customer: event.body.customerId,
      items: [{ plan: process.env[event.body.planId] }],
      expand: ['latest_invoice.payment_intent'],
    });

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
  try {
    const session = await stripe.checkout.sessions.create({
      customer: event.body.customerId,
      success_url: event.body.success_url,
      line_items: [
        { price: event.body.priceId, quantity: 1 },
      ],
      mode: 'subscription',
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url, id: session.id }, null, 4)
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
  event.body = JSON.parse(event.body)
  try {
    await stripe.paymentMethods.attach(
      event.body.paymentMethodId,
      {
        customer: event.body.customerId,
      }
    );
    await stripe.customers.update(
      event.body.customerId,
      {
        invoice_settings: {
          default_payment_method: event.body.paymentMethodId,
        },
      }
    );
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
      subscription_prorate: true,
      customer: event.body.customerId,
      subscription: event.body.subscriptionId,
      // subscription_trial_end: event.body.subscription_trial_end || '',
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          deleted: true,
        },
        {
          plan: process.env[event.body.newPlanId],
          deleted: false,
        },
      ],
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
      event.body.subscriptionId
    );
    const updatedSubscription = await stripe.subscriptions.update(
      event.body.subscriptionId,
      {
        cancel_at_period_end: false,
        items: [
          {
            id: subscription.items.data[0].id,
            plan: process.env[event.body.newPlanId],
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
    event.body = JSON.parse(event.body);
    const paymentMethod = await stripe.paymentMethods.retrieve(
      event.body.paymentMethodId
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
    // stripeSubscriptionDetails = await stripe.subscriptions.retrieve(
    //   subscription_id
    // );

    // if (stripeSubscriptionDetails.id) {
    //   start_date = new Date(stripeSubscriptionDetails.current_period_start * 1000);
    //   end_date = new Date(stripeSubscriptionDetails.current_period_end * 1000);
    // }

    // if (stripeSubscriptionDetails.default_payment_method) {
    //   // set customer's default payment method
    //   await stripe.customers.update(customer_id, {
    //     invoice_settings: {
    //       default_payment_method:
    //         stripeSubscriptionDetails?.default_payment_method,
    //     },
    //   });
    // }
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
  }

};

const webhook = async (event) => {
  event.body = JSON.parse(event.body)
  try {

    // let data;

    // let eventType;
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // if (webhookSecret) {
    //   let event;
    //   let signature = req.headers["stripe-signature"];
    //   console.log("hi", req.rawBody);

    //   try {
    //     event = stripe.webhooks.constructEvent(
    //       req.rawBody,
    //       signature ?? "",
    //       webhookSecret
    //     );
    //   } catch (err) {
    //     return res.status(400).send(err);
    //   }
    //   data = event.data;
    //   eventType = event.type;
    // } else {
    //   data = req.body.data;
    //   eventType = req.body.type;
    // }

    // const handlePayment = async (data: any, eventType: string) => {
    //   try {
    //     console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
    //     // calculate for subscription update and add login to update usage
    //     // "billing_reason": "subscription_update",

    //     await handlePaymentSuccess(
    //       data.object.subscription_details.metadata.user_id,
    //       data.object.customer,
    //       data.object.subscription
    //     );

    //     return res.status(200).send({
    //       status: "Success",
    //       message: `billing_reason: ${data.object.billing_reason}, User:${data.object.customer} :  Success`,
    //     });
    //   } catch (error) {
    //     console.log(`\n Error:billing_reason: ${data.object.billing_reason}, User:${data.object.customer}  `, error)
    //     return res.status(500).send({
    //       status: "Failed",
    //       message: `billing_reason: ${data.object.billing_reason}, User:${data.object.customer}:  failed`,
    //       error
    //     });
    //   }
    // }


    // switch (eventType) {
    //   case "checkout.session.completed":
    //     return res.sendStatus(200)
    //   case "customer.created":
    //     return res.sendStatus(200)
    //   case "invoice.paid":
    //     await handlePayment(data, eventType)
    //   // return res.sendStatus(200)
    //   case "invoice.payment_failed":

    //     console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
    //     // console.log("🚀 ~ file: subscription.controller.ts:575 ~ webhook ~ data.object.billing_reason ==:", data.object.billing_reason == "subscription_cycle")
    //     try {
    //       console.log("🚀 ~ file: subscription.controller.ts:490 ~ webhook ~ data.object.billing_reason:", data.object.billing_reason == "subscription_cycle")
    //       console.log("🚀 ~ file: subscription.controller.ts:502 ~ webhook ~ data.object.metadata.user_id:", data.object.subscription_details.metadata.user_id)
    //       if (data.object.billing_reason == "subscription_cycle") {
    //         await User.update(
    //           {
    //             current_plan_id: 1,
    //             usage: {
    //               pages: 0,
    //               queries: 0,
    //               size: 1,
    //             },
    //           },
    //           {
    //             where: { id: data.object.subscription_details.metadata.user_id },
    //             returning: true,
    //           }
    //         );
    //       }
    //       return res.sendStatus(200)

    //     } catch (err) {
    //       console.log("Error in payment failed evenr:", err)
    //       return res.status(500).json({ Error: JSON.stringify(err) })
    //     }
    //     break;

    //   case "invoice.payment_succeeded":
    //     await handlePayment(data, eventType)
    //     break;

    //   case "customer.subscription.deleted":
    //     console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
    //     // This Event is used to reset usage in USER table and Deleting subscription from Subscription table
    //     const user_id = data.object.metadata.user_id;

    //     const deactiveStatus = ["canceled", "ended"];

    //     try {
    //       if (deactiveStatus.includes(data.object.status)) {
    //         let UpdatedUser = await User.update(
    //           {
    //             current_plan_id: 1,
    //             usage: {
    //               pages: 0,
    //               queries: 0,
    //               size: 1,
    //             },
    //           },
    //           {
    //             where: { id: user_id },
    //             returning: true,
    //           }
    //         );

    //         let subscription_id = UpdatedUser[1][0]?.dataValues?.subscription_id

    //         if (subscription_id)
    //           Subscription.destroy({ where: { id: subscription_id } });
    //       }
    //       return res
    //         .status(200)
    //         .send({ status: "success", message: `subscription ${data.object.status}` });

    //     } catch (error) {
    //       return res.status(500).send({
    //         status: "Failed",
    //         message: `Fail to delete subscription ${user_id}`,
    //         error
    //       });
    //     }
    //     break;

    //   case "customer.subscription.updated":
    //     console.log(`\n stripe_debug_${eventType} >>>>>>>>`, JSON.stringify(data));
    //     return res.status(200).send({ status: "success", message: "success" });
    //     break;
    //   default:
    //     res.sendStatus(200)
    //     break;
    // }
    // return;

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
  retriveCustomerPaymentMethod
}
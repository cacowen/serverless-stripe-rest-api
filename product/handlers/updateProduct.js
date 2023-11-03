'use strict';

const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
const tableName = 'Product';

module.exports.updateProduct = async (event) => {
  console.log('running');

  const id = event.pathParameters?.id;

  if (!id || !event.body) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const productToUpdate = JSON.parse(event.body);

    validateRequest(productToUpdate);

    const product = {
      ...productToUpdate,
      productId: id
    };

    await docClient
      .put({
        TableName: tableName,
        Item: product
      })
      .promise();

    return getResponse(200, JSON.stringify(product), null);
  } catch (error) {
    return getResponse(400, null, error);
  }
};

function validateRequest(request) {
  var errors = [];

  if (!request.name)
    errors.push('Product Name is required.');

  if (!request.description)
    errors.push('Product Description is required.');

  if (!request.price)
    errors.push('Product Price is required.');

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

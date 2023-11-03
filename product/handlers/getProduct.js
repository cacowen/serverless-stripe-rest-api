'use strict';

const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
const tableName = 'Product';

module.exports.getProduct = async (event) => {
  console.log('running');

  const id = event.pathParameters?.id;

  if (!id) {
    console.log('Nothing submitted.');

    return getResponse(400, null, 'Request not found');
  }

  try {
    const product = await docClient
      .get({
        TableName: tableName,
        Key: { productId: id }
      })
      .promise();

    return product
      ? getResponse(200, JSON.stringify(product), null)
      : getResponse(404, null, null);
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

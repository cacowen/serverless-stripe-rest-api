# AWS Lambda functions for integrating with Stripe.

## Handlers

### Customer

#### createStripeCustomer

_purpose: create a new stripe customer_

* method: `/stripe/customers`
* type: `post`

input

``` json
```

output

``` json
```

#### deleteStripeCustomer

_purpose: remove a stripe customer_

* method: `/stripe/customers/{id}`
* type: `delete`

input

``` json
```

output

``` json
```

#### getStripeCustomer

_purpose: retrieve a stripe customer_

* method: `/stripe/customers/{id}`
* type: `get`

input

``` json
```

output

``` json
```

### Payment

#### addOrUpdatePaymentMethod

_purpose: update a payment method_

* method: `/stripe/pm/{id}`
* type: `post`

input

``` json
```

output

``` json
```

#### createStripeCheckout

_purpose: checkout - add subscription_

* method: `/stripe/subscriptions/create`
* type: `post`

input

``` json
```

output

``` json
```

#### retrieveCustomerPaymentMethod

_purpose: retrieve payment method_

* method: `/stripe/pm/{id}`
* type: `get`

input

``` json
```

output

``` json
```

#### upcomingInvoices

_purpose: ???_

* method: `/stripe/invoices/upcoming`
* type: `post`

input

``` json
```

output

``` json
```

### Subscription

#### createStripeSubscription

_purpose: create subscription_

* method: `/stripe/subscriptions`
* type: `post`

input

``` json
```

output

``` json
```

#### deleteStripeSubscription

_purpose: remove subscription_

* method: `/stripe/subscriptions/{id}`
* type: `delete`

input

``` json
```

output

``` json
```

#### getStripeSubscription

_purpose: retrieve subscription_

* method: `/stripe/subscriptions/{id}`
* type: `get`

input

``` json
```

output

``` json
```

#### stopOrRestartStripeSubscription

_purpose: pause subscription_

* method: `/stripe/subscriptions/{id}/stop-or-restart`
* type: `put`

input

``` json
```

output

``` json
```

#### upgradeOrDownGradeSubscription

_purpose: change subscription_

* method: `/stripe/subscriptions/{id}/upgrade-or-downgrade`
* type: `put`

input

``` json
```

output

``` json
```

### Webhook

#### webhook

_purpose: handle stripe changes_

* method: `/stripe/webhook`
* type: `post`

input

``` json
```

output

``` json
```

/* The events Meta accepts for business messaging (Conversions API), with plain-language names. [name, label, when to send it, only once per lead] */
export const EVENTS = [
  ['LeadSubmitted', 'Lead', 'They shared their details or showed clear interest.', true],
  ['QualifiedLead', 'Qualified lead', 'They fit your ideal customer and are worth following up.', true],
  ['Purchase', 'Purchase', 'They bought something. Needs the order value.', false],
  ['InitiateCheckout', 'Started checkout', 'They began paying or placing an order.', true],
  ['AddToCart', 'Added to cart', 'They picked something to buy.', true],
  ['ViewContent', 'Viewed a product', 'They looked at a product or page you sent.', true],
  ['CartAbandoned', 'Abandoned cart', 'They left before finishing the order.', true],
  ['OrderCreated', 'Order created', 'An order was placed in your system.', false],
  ['OrderShipped', 'Order shipped', 'The order is on its way.', false],
  ['OrderDelivered', 'Order delivered', 'The order arrived.', false],
  ['OrderCanceled', 'Order canceled', 'The order was canceled.', false],
  ['OrderReturned', 'Order returned', 'The order was returned.', false],
  ['RatingProvided', 'Rating given', 'They rated your service.', false],
  ['ReviewProvided', 'Review given', 'They left a review.', false],
]
export const eventLabel = (name) => EVENTS.find((e) => e[0] === name)?.[1] ?? name

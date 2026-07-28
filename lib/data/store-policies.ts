/**
 * Store policies for Vinameals — adapted from the Ecommerce Website Policy Pack
 * (US / California, Stripe, physical goods, 30-day returns).
 *
 * These pages are operational templates, not legal advice. Confirm practices and
 * obtain legal review before relying on them for compliance.
 */

export type PolicyParagraph = string;

export type PolicySection = {
  id: string;
  number: string;
  title: string;
  summary: string;
  /** Keywords help search find common alternate phrasing. */
  keywords: string[];
  paragraphs: PolicyParagraph[];
  bullets?: string[];
  /** Optional secondary bullet groups with a heading. */
  groups?: { heading: string; bullets: string[] }[];
};

export const POLICY_EFFECTIVE_DATE = "July 27, 2026";

export const POLICY_STORE = {
  name: "Vinameals",
  legalName: "Vinameals",
  site: "https://vinamealsupplies.com",
  email: "support@vinamealsupplies.com",
  city: "Garden Grove, California",
  pickupCity: "Garden Grove, CA"
} as const;

export const storePolicies: PolicySection[] = [
  {
    id: "privacy",
    number: "1",
    title: "Privacy Policy",
    summary:
      "How Vinameals collects, uses, discloses, retains, and protects personal information for visitors, customers, and account holders.",
    keywords: [
      "privacy",
      "ccpa",
      "personal information",
      "data",
      "stripe",
      "california",
      "opt out",
      "children",
      "retention",
      "security"
    ],
    paragraphs: [
      `This Privacy Policy explains how ${POLICY_STORE.name} (“the Store,” “we,” “us”) collects, uses, discloses, retains, and protects personal information when you visit ${POLICY_STORE.site}, create an account, place an order, request a refund, contact support, submit a review, join a marketing list, or otherwise interact with our website, checkout, account tools, and related services (the “Services”).`,
      "Personal information means information that identifies, relates to, describes, can reasonably be linked with, or could reasonably be associated with a person or household. It does not include properly deidentified or aggregate information excluded from applicable law.",
      "The Store does not intentionally collect Social Security numbers, precise geolocation, health information, biometric templates, or other highly sensitive information through ordinary retail checkout unless a specific feature clearly requires it and a separate notice is provided."
    ],
    groups: [
      {
        heading: "Information we collect",
        bullets: [
          "Identifiers and account data: name, billing and shipping address, email, phone, account credentials, customer ID, and order number.",
          "Order and commercial data: products viewed, cart contents, purchases, returns, refunds, discounts, delivery status, and support history.",
          "Payment-related data: payment method type, status, billing address, transaction amount, and masked details. Full card credentials are generally collected and processed by Stripe (or another provider shown at checkout), not stored by the Store.",
          "Device and usage data: IP address, browser and device type, pages viewed, clicks, session activity, cookie identifiers, and approximate location derived from IP address.",
          "Communications, marketing preferences, reviews, and content you voluntarily submit.",
          "Security and fraud data: login history, risk signals, chargeback information, and records used to protect accounts and transactions."
        ]
      },
      {
        heading: "How we use personal information",
        bullets: [
          "Provide the Services, process orders and payments, fulfill shipping or store pickup, and issue returns or refunds.",
          "Authenticate users, secure transactions, detect fraud, prevent abuse, and protect customers and the Store.",
          "Respond to questions, provide support, and keep service records.",
          "Operate, analyze, and improve the website, catalog, checkout, and customer experience.",
          "Personalize content and product recommendations where permitted.",
          "Send marketing messages with appropriate notice and choice, and measure campaign performance.",
          "Comply with tax, accounting, payment-network, recordkeeping, and other legal obligations.",
          "Establish, exercise, or defend legal claims and enforce Store policies."
        ]
      },
      {
        heading: "How we disclose information",
        bullets: [
          "Payment and fraud providers (including Stripe).",
          "Hosting, e-commerce, database, cloud, security, and technical providers that operate the Services.",
          "Shipping carriers, fulfillment partners, and delivery services.",
          "Customer support, communications, email, and SMS providers that perform services for the Store.",
          "Analytics, advertising, affiliate, and social-media partners when their tools are enabled, subject to available consent and opt-out controls.",
          "Professional advisers, auditors, insurers, banks, and legal service providers.",
          "Government authorities, courts, or other parties when required by law or reasonably necessary to protect rights and safety.",
          "A buyer or successor in a business transaction, subject to appropriate safeguards."
        ]
      },
      {
        heading: "Sale, sharing, and targeted advertising",
        bullets: [
          "The Store does not sell personal information for money in the ordinary sense.",
          "Some state privacy laws define “sale,” “sharing,” or “targeted advertising” broadly. Advertising pixels, cross-site analytics, or similar tools may be treated as sale, sharing, or targeted advertising when enabled.",
          "Where applicable, you may opt out through Your Privacy Choices, Cookie Settings, or a recognized browser signal such as Global Privacy Control.",
          "We will not require an account to process an opt-out and will not discriminate for exercising a privacy right."
        ]
      },
      {
        heading: "Retention (defaults)",
        bullets: [
          "Orders, invoices, payments, returns, refunds, and tax records: up to 7 years (or longer if required by law or an active dispute).",
          "Account and profile data: while the account is active, and generally up to 2 years after closure unless linked to retained transactions.",
          "Customer support records: generally up to 3 years after resolution (longer for warranty, fraud, or legal matters).",
          "Marketing consent and preference records: until withdrawn, plus a minimal suppression record to honor opt-outs.",
          "Security, login, and fraud logs: generally up to 24 months, longer when investigating abuse or disputes.",
          "Cookie and analytics identifiers: according to Cookie Settings and provider configuration, generally no longer than 24 months."
        ]
      },
      {
        heading: "Your choices and U.S. state privacy rights",
        bullets: [
          "Update account information through your account or by contacting support.",
          "Unsubscribe from marketing email; transactional order, security, and recall messages may still be sent.",
          "Reply STOP to marketing SMS where supported.",
          "Control cookies through Cookie Settings, browser settings, or device controls (blocking essential cookies may break checkout).",
          "Depending on residence and applicable law, rights may include access, correction, deletion, portability, opt-out of sale/sharing/targeted advertising, limitation of certain sensitive uses, non-discrimination, and appeal of a denied request.",
          "To submit a privacy request, email support with “Privacy Request” in the subject, or use the Contact page and select Privacy. Include request type, state of residence, and email or order information. Do not send government ID unless we specifically request it through a secure method."
        ]
      },
      {
        heading: "California privacy disclosures",
        bullets: [
          "California residents may have rights to know, delete, correct, opt out of sale or sharing, limit qualifying sensitive personal information, and receive non-discriminatory treatment under the CCPA.",
          "Categories that may be collected and disclosed (depending on features used) include identifiers, commercial information, internet activity, approximate geolocation, sensory content you submit, inferences, and limited sensitive data such as account credentials and payment data processed by Stripe.",
          "We process Global Privacy Control and other valid opt-out preference signals as required for covered online activity.",
          "We do not knowingly sell or share personal information of consumers under 16 without required authorization.",
          "Legacy Do Not Track signals are not standardized and may not be recognized; legally recognized opt-out signals are handled as described above.",
          "California Shine the Light: we do not disclose personal information to third parties for their own direct marketing without required choices and notices. California residents may request information under Civil Code section 1798.83 through the Privacy Request channel."
        ]
      },
      {
        heading: "Children, international visitors, and security",
        bullets: [
          "The Services are not directed to children under 13. We do not knowingly collect personal information from children under 13 without valid parental consent.",
          "The Store is operated from the United States. Information may be processed in the U.S. and other countries where service providers operate.",
          "We use reasonable administrative, technical, and physical safeguards (encrypted transmission, access controls, vendor review, logging, backups, and monitoring). No system is completely secure."
        ]
      }
    ]
  },
  {
    id: "notice-at-collection",
    number: "2",
    title: "Notice at Collection",
    summary:
      "Short-form privacy notice for checkout, account, contact, and newsletter forms.",
    keywords: ["notice at collection", "form", "checkout", "collect", "retention"],
    paragraphs: [
      "This Notice at Collection summarizes personal information practices at or before collection. The full Privacy Policy provides additional detail.",
      "We may collect identifiers and contact information; account credentials; order, product, return, refund, and customer service information; payment-related information processed through Stripe; device, browser, cookie, and website activity; approximate location from IP address; marketing preferences; fraud and security data; and content you voluntarily submit (such as reviews or photos).",
      "We use this information to operate the website, create and secure accounts, process payments and refunds, fulfill and deliver orders (including store pickup), provide support, prevent fraud, comply with law, improve the Services, personalize content, send permitted marketing, and measure performance.",
      "Information may be disclosed to payment providers such as Stripe, hosting and security providers, carriers and fulfillment partners, support tools, professional advisers, authorities when legally required, and analytics or advertising partners when those tools are enabled.",
      "The Store does not sell personal information for cash. Advertising and analytics disclosures may be treated as sale, sharing, or targeted advertising under some state laws. Use Your Privacy Choices, Cookie Settings, or a recognized opt-out preference signal where applicable.",
      "We keep information only as long as reasonably necessary for orders, refunds, support, security, tax, accounting, chargeback, dispute, and legal purposes. Default periods are described in the Privacy Policy.",
      "By submitting a form on this website, you acknowledge this Notice at Collection and the Privacy Policy. Marketing consent, where requested, is optional and is not a condition of purchase."
    ]
  },
  {
    id: "cookies",
    number: "3",
    title: "Cookie Policy",
    summary:
      "Cookies, pixels, local storage, analytics, advertising, and preference controls.",
    keywords: ["cookie", "pixel", "analytics", "tracking", "gpc", "do not track"],
    paragraphs: [
      "Cookies are small text files stored by a browser. Pixels and tags record interactions. Local storage and similar tools can remember settings or identifiers. These technologies may be placed by the Store or by service providers and partners."
    ],
    groups: [
      {
        heading: "Cookie categories",
        bullets: [
          "Strictly necessary: cart, checkout, account login, security, fraud prevention, load balancing, consent records, and basic site functions. Always active; the Services may not function without them.",
          "Payment and fraud: Stripe checkout, payment authentication, fraud prevention, and transaction security. Active when payment-related services are used.",
          "Functional: language, region, saved preferences, recently viewed items, and enhanced support. Optional where required.",
          "Analytics: traffic measurement, page performance, conversions, error analysis, and service improvement. Optional where consent is required.",
          "Advertising and social media: interest-based advertising, campaign measurement, retargeting, social sharing, and affiliate attribution. Optional and subject to consent or opt-out controls where required."
        ]
      },
      {
        heading: "Your controls",
        bullets: [
          "Use Cookie Settings (when available) to accept, reject, or customize non-essential categories.",
          "Use Your Privacy Choices to opt out of sale, sharing, or targeted advertising where applicable.",
          "Use browser settings to block or delete cookies. Blocking strictly necessary cookies may prevent checkout, account, or security functions.",
          "Use a legally recognized opt-out preference signal such as Global Privacy Control; covered Store activity will honor the signal as required.",
          "Legacy Do Not Track signals are not standardized and may not be recognized."
        ]
      }
    ]
  },
  {
    id: "terms",
    number: "4",
    title: "Terms of Use and Terms of Sale",
    summary:
      "Rules for website access, accounts, product orders, and customer transactions.",
    keywords: [
      "terms",
      "sale",
      "order",
      "pricing",
      "liability",
      "warranty",
      "eligibility",
      "intellectual property"
    ],
    paragraphs: [
      `These Terms govern use of the Services and purchases from ${POLICY_STORE.name}. The seller is the business identified on the Contact page, checkout, invoice, or order confirmation. By accessing the Services, creating an account, or placing an order, you agree to these Terms and the policies incorporated by reference, including Privacy, Shipping, and Returns. If you do not agree, do not use the Services or submit an order.`,
      "You must be at least the age of legal majority in your jurisdiction, or use the Services with authorization from a parent or legal guardian. Account information must be accurate and kept current. You are responsible for protecting credentials and for activity under your account.",
      "We seek to describe products accurately, but colors, packaging, and appearance may vary because of displays, manufacturing, photography, or updates. Product availability is not guaranteed until we accept the order. Quantity limits may apply. We may correct errors, update information, or discontinue products.",
      "Prices are shown in USD. Where California law requires, the advertised price includes mandatory Store-imposed fees. Government taxes and permitted shipping charges may be calculated and displayed separately. If a pricing or description error occurs, we may contact you for approval of corrected terms or cancel the affected item and issue a full refund. We will not charge a higher amount without authorization.",
      "Submitting an order is an offer to purchase. An automated confirmation acknowledges receipt but does not necessarily mean acceptance. We may accept by shipment confirmation, making the product available for pickup, or otherwise confirming fulfillment. We may reject or cancel an order for stock errors, pricing errors, payment failure, suspected fraud, legal restrictions, abusive activity, or other legitimate reasons. Amounts captured for a canceled order will be refunded to the original payment method.",
      "You authorize the Store and its payment provider to charge the selected payment method for the order total, taxes, shipping, and clearly disclosed charges. A temporary authorization hold may appear before final capture.",
      "Shipping, title, and risk of loss are governed by the Shipping Policy. Returns, refunds, and cancellations are governed by the Returns Policy. Product-specific final-sale or limited-return terms (including many food and perishable items) must be clearly disclosed before purchase.",
      "The Services, including text, graphics, photographs, logos, software, and design, are owned by or licensed to the Store and protected by intellectual-property laws. Except for personal use of the Services, content may not be copied, scraped, resold, or used to train a commercial system without permission or another lawful basis."
    ],
    groups: [
      {
        heading: "Prohibited uses",
        bullets: [
          "Violating law, infringing rights, or engaging in fraud, deception, harassment, or harmful conduct.",
          "Attempting unauthorized access, bypassing security, introducing malware, or disrupting the Services.",
          "Using bots or scrapers in a manner that burdens the Services or violates instructions (except lawful search indexing).",
          "Submitting false orders, payment disputes, reviews, identity information, or return claims."
        ]
      },
      {
        heading: "Warranties, liability, and disputes",
        bullets: [
          "Product warranties, if any, are stated on the product page, packaging, or manufacturer materials. Except for express warranties and non-waivable rights, the Services and products are provided on an as-available basis.",
          "To the maximum extent permitted by law, the Store is not liable for indirect, incidental, special, consequential, or punitive damages. For a claim relating to an order, aggregate liability will not exceed the amount paid for the affected product or order, except where a different remedy is required by law.",
          "These Terms are governed by the laws of the State of California, without overriding mandatory consumer protections in your location. Before filing a claim, please attempt good-faith resolution through the Contact page.",
          "Nothing in these Terms restricts a consumer’s right to contact a regulator, use a lawful chargeback process, or pursue a remedy that cannot be waived."
        ]
      }
    ]
  },
  {
    id: "shipping",
    number: "5",
    title: "Shipping and Delivery Policy",
    summary:
      "Processing, transit estimates, store pickup, delays, tracking, and delivery problems.",
    keywords: [
      "shipping",
      "delivery",
      "pickup",
      "tracking",
      "carrier",
      "cold chain",
      "frozen",
      "address",
      "delay"
    ],
    paragraphs: [
      "Vinameals offers store pickup and shipping to destinations available at checkout. Some products, addresses, territories, P.O. boxes, military addresses, or international destinations may be unavailable because of carrier, legal, customs, product, or temperature-control restrictions.",
      `Store pickup is available at our ${POLICY_STORE.pickupCity} location. Bring your order number and a photo ID. Pickup timing and instructions are shown at checkout and in order communications.`,
      "Unless a product page or checkout states otherwise, standard processing is 1 to 3 business days after payment authorization. Business days exclude weekends and applicable holidays. Preorder, backorder, high-value, verification-required, or cold-chain orders may take longer when disclosed before purchase.",
      "Available methods, estimated transit times, and shipping charges are shown at checkout. Transit time begins after the carrier accepts the package, not when the order is placed. Delivery estimates are not guarantees unless a service is expressly labeled as guaranteed. Weather, carrier disruptions, remote locations, and events outside reasonable control may cause delays.",
      "If we cannot ship within the time promised—or within 30 days after a properly completed order when no time is stated—we will notify you and offer a choice to accept the delay or cancel the affected order for a full refund to the original payment method.",
      "You are responsible for providing a complete and accurate shipping address and phone number for delivery contact. Contact us immediately to request a change. Changes are not guaranteed after fulfillment begins. Additional carrier charges caused by an incorrect address, refused delivery, or unauthorized rerouting may be deducted from a refund when permitted and clearly documented, unless we caused the error.",
      "Tracking is provided when available. An order may ship in multiple packages. A shipment confirmation does not always mean the carrier has scanned the package."
    ],
    groups: [
      {
        heading: "Delivery problems",
        bullets: [
          "Not received: check tracking, nearby delivery locations, household members, and carrier notices, then contact us promptly with your order number.",
          "Marked delivered but missing: contact us and the carrier. We may request a carrier case number or delivery confirmation for high-value claims, but will not impose unreasonable proof requirements.",
          "Damaged, defective, or incorrect item: report preferably within 7 days of delivery with the order number and clear photos. A delay in reporting does not waive non-waivable warranty or consumer rights.",
          "Refused or undeliverable package: after return to us, we may refund the product price less permitted, documented shipping or handling costs, unless we or the carrier caused the issue."
        ]
      },
      {
        heading: "Food, frozen, and temperature-sensitive items",
        bullets: [
          "Some pantry, beverage, snack, sauce, and frozen products may have special packing or carrier requirements.",
          "For temperature-sensitive shipments, we use packaging and methods appropriate for the product and destination when shipping is offered for that item.",
          "Once a package is delivered or marked delivered according to carrier records, risk of spoilage from delayed retrieval, extreme weather at the delivery location, or improper storage is generally the customer’s responsibility unless the Store or carrier caused the problem or law requires another remedy.",
          "If a temperature-sensitive item arrives damaged or spoiled, contact us promptly with photos so we can investigate."
        ]
      }
    ]
  },
  {
    id: "returns",
    number: "6",
    title: "Returns, Refunds, Exchanges, and Cancellations",
    summary:
      "Default 30-day return policy for eligible merchandise, with food and perishable exclusions.",
    keywords: [
      "return",
      "refund",
      "exchange",
      "cancel",
      "restocking",
      "perishable",
      "food",
      "final sale",
      "chargeback"
    ],
    paragraphs: [
      "Policy summary: Eligible non-food merchandise may be returned within 30 days after delivery when unused and in original condition. The customer pays return shipping unless the item is defective, damaged, incorrect, or we state otherwise. Approved refunds are issued to the original payment method.",
      "Unless a product page clearly states a different lawful policy before purchase, an eligible item may be returned within 30 calendar days after confirmed delivery. We may offer a longer holiday or promotional window in writing.",
      "To start a return: contact us with the order number, item, reason, and photos when relevant; wait for return authorization and shipping instructions; package the item securely; use a trackable service for higher-value items; and keep the receipt until the return is completed.",
      "After approval, we generally submit the refund to the original payment method within 5 business days. Banks typically take about 5 to 10 business days to display a card refund (sometimes up to 30 days). A refund issued soon after the original charge may appear as a reversal.",
      "Cancellation requests should be submitted immediately. We will attempt to cancel before fulfillment, but cancellation is not guaranteed after picking or carrier handoff. If the order cannot be canceled, you may use the return process if eligible. A canceled, unshipped order receives a full refund.",
      "Customers are encouraged to contact the Store first so a missing item, return, or refund can be resolved quickly. This does not waive a lawful card dispute or chargeback right. Please tell us if a payment dispute has already been filed to avoid duplicate reimbursement.",
      "California notice: This 30-day policy is intended to provide at least the common seven-day refund, credit, or exchange treatment described by California law for eligible goods. Limited or no-return categories must be conspicuously disclosed before purchase."
    ],
    groups: [
      {
        heading: "Eligibility conditions",
        bullets: [
          "The item is unused, unopened when seals matter, unaltered, and in substantially the same condition as received.",
          "Original labels, components, and packaging are included when reasonably necessary for resale or verification.",
          "Proof of purchase is provided (order number, receipt, or purchaser email).",
          "The return is shipped using the instructions and authorization provided by the Store."
        ]
      },
      {
        heading: "Items generally not returnable",
        bullets: [
          "Perishable goods, food, beverages, and other items that cannot be safely resold once shipped or opened (including most grocery, frozen, and ready-to-eat products).",
          "Customized, personalized, made-to-order, or altered goods produced as ordered.",
          "Gift cards, downloadable products, digital codes, and services already performed, except where law requires a remedy.",
          "Sealed hygiene or health-related items after the seal is opened, when resale would create a health concern.",
          "Hazardous materials or products subject to carrier or legal return restrictions.",
          "Items clearly marked Final Sale, As Is, No Returns, or similar language before purchase.",
          "Items damaged, used, incomplete, or materially altered after delivery, except for a defect or problem not caused by the customer."
        ]
      },
      {
        heading: "Return shipping and refunds",
        bullets: [
          "Customer is responsible for return shipping on change-of-mind returns unless we provide a prepaid label.",
          "The Store pays reasonable return shipping for a verified defective, damaged, or incorrect item.",
          "Original outbound shipping is not refundable for change-of-mind returns unless we made the error or law requires a full refund.",
          "We may inspect returns and apply a documented partial refund for missing parts, damage, or excessive use where permitted by law.",
          "A restocking fee applies only if clearly disclosed before purchase."
        ]
      }
    ]
  },
  {
    id: "payments",
    number: "7",
    title: "Payment, Billing, Fraud Review, and Chargebacks",
    summary:
      "Stripe processing, authorizations, refunds, security, and payment disputes.",
    keywords: ["payment", "stripe", "billing", "chargeback", "fraud", "refund", "card"],
    paragraphs: [
      "We accept only the payment methods displayed at checkout. Availability may vary by location, device, order value, risk review, and Stripe configuration. You must use a payment method you are authorized to use.",
      "Stripe may process card, bank, wallet, authentication, refund, and fraud-prevention data. We may receive tokenized payment details, status, brand, last four digits, billing information, transaction identifiers, and fraud results. Stripe’s privacy notice applies to its independent processing.",
      "Checkout may create an authorization hold before a charge is completed. A hold is not always a final charge and may remain visible until the issuing bank releases it. We may capture payment when the order is accepted, prepared, shipped, ready for pickup, or otherwise fulfilled, depending on the payment method and checkout flow.",
      "You authorize the order total shown at checkout, including product price, taxes, shipping, and clearly disclosed charges. Your bank may apply foreign-exchange or international fees that we do not control.",
      "An order may be delayed, rejected, or canceled if payment is declined, incomplete, reversed, expired, disputed, or fails verification. We will not request a full card number by ordinary email, text, or chat.",
      "We and Stripe may screen orders for fraud and other risks. We may request reasonable verification, delay shipment, limit quantity, or cancel and refund an order.",
      "Refunds use the original payment method when possible. Timing is governed by the Returns Policy and your payment method. Customers should not seek both a Store refund and a chargeback for the same amount without disclosure.",
      "A payment method is saved only when you choose a feature that permits storage (such as an account wallet or Stripe Link) or when another lawful basis applies. The payment provider, not the Store, may store the full credential."
    ]
  },
  {
    id: "subscriptions",
    number: "8",
    title: "Automatic Renewal and Subscription Policy",
    summary:
      "Applies only when a product is clearly offered as a subscription, membership, recurring shipment, or free trial.",
    keywords: ["subscription", "auto renew", "recurring", "trial", "cancel", "arl"],
    paragraphs: [
      "Conditional policy: If Vinameals does not offer subscriptions, recurring shipments, memberships, or free trials that convert to paid service, this section has no effect. We will not display a recurring-payment option unless checkout is configured to follow these rules.",
      "Before obtaining payment information or consent for a subscription, we will clearly disclose the product or service, renewal nature, initial and recurring price, billing frequency, any minimum term, trial or promotional period, price after the trial, cancellation method, refund terms, and material restrictions.",
      "We will obtain express affirmative consent to automatic-renewal or continuous-service terms before charging. Consent will not be inferred from silence, a pre-checked box, or agreement to unrelated terms.",
      "After enrollment, we will provide a confirmation that can be retained, including recurring terms, cancellation policy, and cancellation instructions.",
      "You authorize recurring charges at the disclosed amount and frequency until cancellation. If a price or material term changes, we will provide advance notice and obtain additional consent when required.",
      "For California consumers, we will provide renewal, trial-end, fee-change, and annual reminders within the time windows required by California automatic-renewal law when those rules apply.",
      "Cancellation will be simple and available online for online enrollments, without obstructive steps. Cancellation stops future renewals after the effective date. An order already processed or shipped may be subject to the Returns Policy."
    ]
  },
  {
    id: "promotions",
    number: "9",
    title: "Promotions, Coupons, Gift Cards, and Pricing",
    summary: "Offer rules, discount limits, gift-card treatment, and price transparency.",
    keywords: ["promotion", "coupon", "discount", "gift card", "pricing", "sale"],
    paragraphs: [
      "Each promotion, coupon, loyalty benefit, giveaway, or limited-time offer may include specific eligibility, product, date, location, quantity, and redemption rules. Those specific terms control if they conflict with this general policy.",
      "Unless stated otherwise, one coupon or promotion applies per order and offers cannot be combined. Discounts apply only to eligible products and may exclude taxes, shipping, gift cards, subscriptions, prior purchases, final-sale items, or specified brands. A coupon has no cash value and cannot be resold or redeemed after expiration except where law requires otherwise.",
      "Where California law applies, the displayed price includes mandatory Store-imposed fees. Government taxes and permitted shipping charges may be shown separately. Optional add-ons are not included unless selected.",
      "A comparison, regular, list, or sale price will be used only when we have a reasonable basis for the comparison. We will not create a false discount with a fictitious reference price.",
      "Gift cards and store credits are subject to terms disclosed at purchase or issuance and applicable law. They are not redeemable for cash except where law requires. Lost or stolen codes may be replaced only with sufficient proof and remaining balance.",
      "We may limit quantity, cancel abusive redemptions, correct a technical error, or require verification. If an accepted order is canceled because of a Store error, you receive a full refund of the canceled amount."
    ]
  },
  {
    id: "reviews",
    number: "10",
    title: "Reviews, Testimonials, and User Content",
    summary: "Truthful reviews, incentives, moderation, licensing, and prohibited content.",
    keywords: ["review", "testimonial", "user content", "fake review", "moderation"],
    paragraphs: [
      "A review or testimonial must reflect the submitter’s genuine opinion and actual experience with the product, service, or Store. You may not create, buy, sell, or submit a fake review; impersonate another person; review a product you have not experienced; or misrepresent a material fact.",
      "We may offer a discount, sample, or other incentive for an honest review only when the incentive is not conditioned on positive or negative sentiment. Material connections must be disclosed where required. Employees, owners, agents, family members, and influencers must disclose their relationship.",
      "We may delay, reject, remove, or edit content under viewpoint-neutral rules for spam, irrelevance, threats, harassment, hate, obscenity, malware, fraud, unlawful content, private information, intellectual-property infringement, or good-faith belief that a submission is fake or not based on actual experience. We will not suppress a review merely because it is negative.",
      "By submitting content, you grant the Store a non-exclusive, worldwide, royalty-free license to host, reproduce, format, display, and distribute the content for operating, promoting, and improving the Store, subject to privacy law. You retain ownership.",
      "Do not post payment-card numbers, passwords, government identifiers, private addresses, medical information, another person’s personal information, or confidential business information."
    ]
  },
  {
    id: "communications",
    number: "11",
    title: "Email and SMS Communications",
    summary:
      "Transactional messages, marketing consent, unsubscribe, STOP, and contact preferences.",
    keywords: ["email", "sms", "marketing", "unsubscribe", "can-spam", "text"],
    paragraphs: [
      "We may send non-marketing communications necessary for an order, account, payment, refund, delivery, pickup, warranty, recall, security alert, policy update, or customer service request—even if you have opted out of marketing, to the extent permitted by law.",
      "Marketing email will use accurate sender information, a subject line that reflects the content, a valid physical postal address, and a clear unsubscribe method. We will honor a valid marketing-email opt-out within 10 business days.",
      "SMS marketing is sent only with the consent required by law. Consent to marketing texts is not a condition of purchase unless law allows and the offer clearly states otherwise. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help where those commands are supported.",
      "We may send service texts for order verification, delivery, pickup, security, or support when requested or permitted. Opting out of marketing does not necessarily stop a transactional message needed for an active request.",
      "You may update preferences through an account, email unsubscribe link, SMS command, Cookie Settings, or the Contact page. We may keep a minimal suppression record so the opt-out remains effective."
    ]
  },
  {
    id: "accessibility",
    number: "12",
    title: "Accessibility Statement",
    summary: "Commitment to inclusive access and a practical assistance channel.",
    keywords: ["accessibility", "wcag", "ada", "disability", "assistive"],
    paragraphs: [
      "Vinameals is committed to providing people with disabilities with access to our goods, services, information, and customer support. Accessibility is an ongoing effort that includes design, development, content, testing, vendor management, and response to user feedback.",
      "We aim to follow generally recognized accessibility practices and use WCAG 2.1 Level AA as a technical goal where appropriate. This statement describes a goal and ongoing process, not a claim that every page, document, or third-party feature is free from all barriers.",
      "Practices include meaningful headings and labels, keyboard navigation, text alternatives for meaningful images, readable text and contrast, clear form errors, testing of important flows, and review of third-party checkout and payment tools.",
      `If you have difficulty using the website, email ${POLICY_STORE.email} with “Accessibility” in the subject. Identify the page, feature, assistive technology, and requested task. We will make reasonable efforts to provide the information, complete the transaction through an accessible alternative, and correct confirmed barriers.`,
      "Customer-facing policies are published as accessible HTML. Upon request, we will make reasonable efforts to provide policy or product information in another accessible format."
    ]
  },
  {
    id: "contact-changes",
    number: "13",
    title: "Contact, Policy Changes, and Legal Notices",
    summary: "How to reach Vinameals and how policy updates work.",
    keywords: ["contact", "policy change", "legal notice", "seller", "update"],
    paragraphs: [
      `The Store is ${POLICY_STORE.legalName}, operating the website ${POLICY_STORE.site}. Support email: ${POLICY_STORE.email}. Principal place of business / pickup area: ${POLICY_STORE.city}.`,
      "Use the Contact page and select the appropriate topic: Order, Shipping, Return, Payment, Privacy, Accessibility, Subscription, Review, or Legal. Include the order number when relevant. Do not send full payment credentials, passwords, Social Security numbers, or unnecessary identity documents.",
      "Privacy requests: place “Privacy Request” in the subject and include the request type, state of residence, and email or order information associated with the Store. We will provide a secure method if identity documentation becomes necessary.",
      "A product-specific term, promotion term, subscription confirmation, wholesale agreement, or written contract may supplement these policies. A specific term controls only for the subject it clearly addresses. Mandatory law controls over any conflicting policy language.",
      "We may update policies to reflect changes in law, vendors, products, technology, or operations. We will post the revised effective date and provide additional notice when required. Changes apply prospectively unless law permits otherwise. The version in effect when an order is accepted generally governs that order.",
      "We review this policy pack at least once every 12 months and after adding material new analytics, advertising, payment, subscription, shipping, return, or data-sharing practices."
    ]
  }
];

export function policySearchText(section: PolicySection) {
  const parts = [
    section.number,
    section.title,
    section.summary,
    ...section.keywords,
    ...section.paragraphs,
    ...(section.bullets ?? []),
    ...(section.groups ?? []).flatMap((g) => [g.heading, ...g.bullets])
  ];
  return parts.join("\n").toLowerCase();
}

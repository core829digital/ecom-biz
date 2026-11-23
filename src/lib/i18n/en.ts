/**
 * English source dictionary. Every key here MUST exist in it.ts (enforced by the type checker).
 * Keys are grouped by area: common, field, validation, auth, nav, admin areas, storefront (sf.*), email.
 */
export const en = {
  // common
  "common.save": "Save",
  "common.saved": "Saved",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.create": "Create",
  "common.back": "Back",
  "common.search": "Search",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.none": "None",
  "common.all": "All",
  "common.yes": "Yes",
  "common.no": "No",
  "common.previous": "Previous",
  "common.next": "Next",
  "common.confirmDelete": "Delete permanently? This cannot be undone.",
  "common.deleted": "Deleted",
  "common.notFound": "Not found",
  "common.optional": "optional",
  "common.view": "View",
  "common.total": "Total",
  "common.date": "Date",
  "common.name": "Name",
  "common.page": "Page {page} of {pages}",

  // fields
  "field.email": "Email",
  "field.password": "Password",
  "field.newPassword": "New password",
  "field.fullName": "Full name",
  "field.storeName": "Store name",
  "field.storeAddress": "Store address",
  "field.contactEmail": "Contact email",
  "field.country": "Country",
  "field.currency": "Currency",
  "field.storeLanguage": "Store language",

  // validation
  "validation.required": "This field is required",
  "validation.email": "Enter a valid email address",
  "validation.passwordLength": "Use at least 8 characters",
  "validation.fixErrors": "Please fix the highlighted fields.",

  // landing / auth
  "landing.title": "Start selling online today",
  "landing.subtitle": "Create a store, add your products and accept payments in minutes. Everything you need to run your business in one place.",
  "landing.cta": "Create your store",
  "auth.login": "Log in",
  "auth.logout": "Log out",
  "auth.signup": "Create account",
  "auth.login.title": "Welcome back",
  "auth.login.subtitle": "Log in to manage your stores.",
  "auth.signup.title": "Create your account",
  "auth.signup.subtitle": "Start your free trial. No card required.",
  "auth.signup.haveAccount": "Already have an account?",
  "auth.forgot.link": "Forgot password?",
  "auth.forgot.title": "Reset your password",
  "auth.forgot.subtitle": "We'll email you a link to choose a new password.",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.sent": "If an account exists for that email, a reset link is on its way.",
  "auth.reset.title": "Choose a new password",
  "auth.reset.submit": "Update password",
  "auth.error.invalidCredentials": "Incorrect email or password.",
  "auth.error.rateLimited": "Too many attempts. Please wait a few minutes and try again.",
  "auth.error.emailTaken": "An account with this email already exists.",
  "auth.error.resetInvalid": "This reset link is invalid or has expired.",

  // roles
  "role.OWNER": "Owner",
  "role.ADMIN": "Admin",
  "role.STAFF": "Staff",

  // stores
  "stores.title": "Your stores",
  "stores.create": "Create store",
  "stores.empty": "You don't have any stores yet.",
  "stores.new.title": "Create a new store",
  "stores.new.subtitle": "You can change all of this later.",
  "stores.new.slugInvalid": "Use 3–40 lowercase letters, numbers or dashes.",
  "stores.new.slugTaken": "This address is already taken.",

  // navigation
  "nav.home": "Home",
  "nav.orders": "Orders",
  "nav.products": "Products",
  "nav.inventory": "Inventory",
  "nav.collections": "Collections",
  "nav.customers": "Customers",
  "nav.discounts": "Discounts",
  "nav.onlineStore": "Online store",
  "nav.theme": "Theme",
  "nav.pages": "Pages",
  "nav.navigation": "Navigation",
  "nav.domains": "Domains",
  "nav.settings": "Settings",
  "nav.general": "General",
  "nav.payments": "Payments",
  "nav.shipping": "Shipping",
  "nav.taxes": "Taxes",
  "nav.checkout": "Checkout",
  "nav.staff": "Staff",
  "nav.billing": "Plan & billing",
  "nav.developers": "Developers",
  "nav.viewStore": "View store",
  "nav.menu": "Menu",
  "nav.switchStore": "Switch store",
  "nav.allStores": "All stores",
  "admin.banner.paused": "Your store is paused. Choose a plan in Settings → Plan & billing to resume selling.",

  // platform admin
  "platform.title": "Platform",

  // emails
  "email.reset.subject": "Reset your password",
  "email.reset.body": "Someone requested a password reset for your account. If this was you, use the button below. The link expires in 1 hour.",
  "email.reset.cta": "Choose a new password",
} as const;

export type MessageKey = keyof typeof en;

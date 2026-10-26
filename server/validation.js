import {body,validationResult} from 'express-validator';
import {AppError} from './errors.js';

export function jsonRequest(req,res,next) {
  if(!req.is('application/json')) return next(new AppError(400,'INVALID_BODY','Send your request as application/json.'));
  if(!req.body || typeof req.body!=='object' || Array.isArray(req.body)) return next(new AppError(400,'INVALID_BODY','Send a JSON object containing your details.'));
  next();
}
const extraFields = (object,allowed) => Object.keys(object).some(key=>!allowed.includes(key));
export function strictBody(checkout) {
  return (req,res,next)=>{
    if(extraFields(req.body,checkout?['customer','items']:['items'])) return next(new AppError(422,'VALIDATION_ERROR','Unexpected fields. Prices and totals are calculated by the server.'));
    if(checkout && req.body.customer && typeof req.body.customer==='object' && !Array.isArray(req.body.customer) && extraFields(req.body.customer,['name','email','phone','address','city','pincode'])) return next(new AppError(422,'VALIDATION_ERROR','Unexpected customer details. Send only the requested delivery information.'));
    if(Array.isArray(req.body.items) && req.body.items.some(item=>item && typeof item==='object' && extraFields(item,['productId','size','quantity']))) return next(new AppError(422,'VALIDATION_ERROR','Item prices are set by the server. Send productId, size and quantity only.'));
    next();
  };
}
const itemsRules = () => [
  body('items').isArray({min:1,max:20}).withMessage('Your bag must contain between 1 and 20 different items.').bail().custom(items=>{
    const keys=items.map(item=>`${item?.productId}:${item?.size}`);
    if(new Set(keys).size!==keys.length) throw new Error('Combine duplicate product and size selections into one bag item.'); return true;
  }),
  body('items.*').custom(item=>item!==null && typeof item==='object' && !Array.isArray(item)).withMessage('Each bag item must contain a product, size and quantity.'),
  body('items.*.productId').isString().withMessage('Choose a valid product.').bail().matches(/^[a-z0-9][a-z0-9-]{2,49}$/).withMessage('Choose a valid product ID.'),
  body('items.*.size').custom(size=>typeof size==='number' && Number.isInteger(size) && size>=1 && size<=15).withMessage('Choose a valid UK size.'),
  body('items.*.quantity').custom(quantity=>typeof quantity==='number' && Number.isInteger(quantity) && quantity>=1 && quantity<=5).withMessage('Choose a whole quantity between 1 and 5.')
];
const customerRules = () => [
  body('customer').isObject({strict:true}).withMessage('Enter your contact and delivery details.'),
  body('customer.name').isString().withMessage('Enter your full name.').bail().trim().isLength({min:2,max:100}).withMessage('Enter a name between 2 and 100 characters.').bail().custom(value=>!/[\u0000-\u001f\u007f]/.test(value)).withMessage('Your name contains an invalid character.'),
  body('customer.email').isString().withMessage('Enter your email address.').bail().trim().isLength({max:254}).isEmail({allow_utf8_local_part:false}).withMessage('Enter a valid email address.').bail().customSanitizer(value=>value.toLowerCase()),
  body('customer.phone').isString().withMessage('Enter your mobile number.').bail().trim().customSanitizer(value=>value.replace(/[\s()-]/g,'').replace(/^\+91/,'')).matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit Indian mobile number.'),
  body('customer.address').isString().withMessage('Enter your delivery address.').bail().trim().isLength({min:10,max:240}).withMessage('Enter a delivery address between 10 and 240 characters.').bail().custom(value=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)).withMessage('Your address contains an invalid character.'),
  body('customer.city').isString().withMessage('Enter your city.').bail().trim().isLength({min:2,max:60}).withMessage('Enter a city between 2 and 60 characters.').bail().matches(/^[\p{L}\p{M} .’'-]+$/u).withMessage('Enter a valid city name.'),
  body('customer.pincode').isString().withMessage('Enter your PIN code.').bail().trim().matches(/^[1-9]\d{5}$/).withMessage('Enter a valid 6-digit Indian PIN code.')
];
function result(req,res,next) {
  const errors=validationResult(req);
  if(errors.isEmpty()) return next();
  const fields={};for(const error of errors.array()) if(!fields[error.path]) fields[error.path]=error.msg;
  next(new AppError(422,'VALIDATION_ERROR',Object.values(fields)[0],fields));
}
export const validateCart = [jsonRequest,strictBody(false),...itemsRules(),result];
export const validateCheckout = [jsonRequest,strictBody(true),...itemsRules(),...customerRules(),result];

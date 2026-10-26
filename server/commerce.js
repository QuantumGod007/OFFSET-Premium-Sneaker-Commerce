import {randomBytes} from 'node:crypto';
import {catalog,productById,shippingPolicy} from './catalog.js';
import {AppError} from './errors.js';
export const initialState=()=>({version:1,stock:Object.fromEntries(catalog.map(p=>[p.id,{...p.initialStock}])),orders:[]});
export function product(state,id) {
    const item=productById.get(id);if(!item)throw new AppError(404,'PRODUCT_NOT_FOUND','This sneaker could not be found.');
    const {initialStock,...publicProduct}=item;
    return {...publicProduct,stock:{...state.stock[id]||initialStock}};
  }
export function quote(items,snapshot) {
    const lines=items.map((item,index)=>{
      const product=productById.get(item.productId);
      if(!product)throw new AppError(404,'PRODUCT_NOT_FOUND','A sneaker in your bag is no longer in the catalog.',{[`items[${index}].productId`]:'Remove this unknown product from your bag.'});
      const stock=snapshot.stock[product.id]||product.initialStock;
      if(!Object.hasOwn(stock,String(item.size)))throw new AppError(422,'INVALID_SIZE',`UK ${item.size} is not an available size for ${product.name}.`,{[`items[${index}].size`]:'Choose one of the sizes shown for this sneaker.'});
      if(item.quantity>stock[item.size])throw new AppError(409,'OUT_OF_STOCK',stock[item.size]===0?`${product.name} in UK ${item.size} has sold out. Choose another size.`:`Only ${stock[item.size]} pair${stock[item.size]===1?'':'s'} of ${product.name} in UK ${item.size} remain.`,{[`items[${index}].quantity`]:'Update this item to match the available stock.'});
      return {productId:product.id,brand:product.brand,name:product.name,color:product.color,image:product.image,fallback:product.fallback,size:item.size,quantity:item.quantity,unitPrice:product.price,lineTotal:product.price*item.quantity,availableStock:stock[item.size]};
    });
    const subtotal=lines.reduce((sum,item)=>sum+item.lineTotal,0),shipping=subtotal>=shippingPolicy.freeAbove?0:shippingPolicy.fee;
    return {items:lines,subtotal,shipping,total:subtotal+shipping,currency:'INR',itemCount:lines.reduce((sum,item)=>sum+item.quantity,0)};
  }
export const publicOrder=order=>({reference:order.reference,status:order.status,items:order.items,subtotal:order.subtotal,shipping:order.shipping,total:order.total,currency:order.currency,createdAt:order.createdAt,delivery:{city:order.customer.city,pincode:order.customer.pincode},demo:true});

export function placeOrder(state,input) {
  const priced=quote(input.items,state);
  const order={...priced,reference:`OF-${randomBytes(12).toString('hex').toUpperCase()}`,status:'confirmed',customer:input.customer,createdAt:new Date().toISOString()};
  for(const item of priced.items){state.stock[item.productId]||={...productById.get(item.productId).initialStock};state.stock[item.productId][item.size]-=item.quantity;}
  state.orders.push(order);return publicOrder(order);
}
export function findOrder(state,reference) {
  const order=state.orders.find(order=>order.reference===reference);
  if(!order)throw new AppError(404,'ORDER_NOT_FOUND','We couldn’t find an order with that reference.');
  return publicOrder(order);
}

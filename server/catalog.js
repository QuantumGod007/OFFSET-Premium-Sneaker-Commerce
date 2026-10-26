const products = [
  ['nb-9060','New Balance','9060','Sea Salt / Concrete','runners',14999,'Sculpted lines. A softer landing. The 9060 reworks the familiar language of the 99X series with an exaggerated, distinctly modern silhouette.',true],
  ['nike-dunk-low','Nike','Dunk Low Retro','White / Black','court',8995,'The court classic, stripped back to its most versatile colourway. Crisp leather, clean panelling and a low profile made for the everyday rotation.',false],
  ['adidas-samba','adidas','Samba OG','Cloud White / Core Black / Gum','everyday',10999,'From the indoor pitch to everywhere else. A low-cut leather upper, suede toe and unmistakable gum sole keep the Samba in a league of its own.',true],
  ['asics-kayano-14','ASICS','GEL-KAYANO 14','Cream / Black / Metallic Plum','runners',13999,'Late-2000s running design with a new point of view. Layered mesh, metallic details and visible GEL cushioning give this pair its unmistakable presence.',true],
  ['nike-air-max-1','Nike',"Air Max 1 ’86 OG",'Big Bubble / University Red','runners',13995,'The original revolution in visible Air. The ’86 silhouette brings a bigger window, heritage lines and a flash of University Red.',true],
  ['adidas-campus-00s','adidas','Campus 00s','Grey Three / Cloud White','court',10999,'A skate-era take on a terrace favourite. Plush suede, wider proportions and bold three stripes bring an easy confidence to any rotation.',false],
  ['asics-gel-1130','ASICS','GEL-1130','White / Clay Canyon','runners',9999,'A considered balance of airy mesh and warm metallic tones. The GEL-1130 brings late-2000s running character into an everyday setting.',true],
  ['adidas-gazelle','adidas','Gazelle Indoor','Green / Gum','everyday',11999,'Rich green suede meets a translucent gum sole. A timeless indoor silhouette with just the right amount of colour.',false],
];
export const catalog = products.map(([id,brand,name,color,category,price,description,newArrival],index) => ({
  id,brand,name,color,category,price,description,newArrival,currency:'INR',
  image:`/assets/${id}.jpg`,fallback:`/assets/${id}-small.jpg`,
  initialStock:{'6':index===0?0:2,'7':3,'8':4,'9':index===3?0:3,'10':2,'11':1}
}));
export const productById = new Map(catalog.map(product=>[product.id,product]));
export const categories = ['everyday','runners','court'];
export const shippingPolicy = {freeAbove:12000,fee:199};

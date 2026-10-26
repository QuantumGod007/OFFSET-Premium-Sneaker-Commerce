export class AppError extends Error {
  constructor(status,code,message,fields={}) { super(message); Object.assign(this,{status,code,fields}); }
}
export function errorHandler(error,req,res,next) {
  if(error.type==='entity.too.large') return res.status(413).json({success:false,error:'BODY_TOO_LARGE',message:'This request is too large. Keep it under 16 KB.'});
  if(error.type==='entity.parse.failed') return res.status(400).json({success:false,error:'INVALID_JSON',message:'The request contains invalid JSON.'});
  if(error instanceof AppError) return res.status(error.status).json({success:false,error:error.code,message:error.message,...(Object.keys(error.fields).length?{fields:error.fields}:{})});
  console.error('OFFSET request failed:',error);
  res.status(500).json({success:false,error:'INTERNAL_ERROR',message:'We couldn’t complete that request. Please try again.'});
}

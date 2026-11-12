import jwt from "jsonwebtoken";


 export function authUser(req,res,next){
    const token = req.cookie.token;
    if(!token){
        return req.staus(401).json({
            message :"unauthorizwd",
            success:false,
            err:"no error provided"
        })
    }
    try{
        const decoded = jwt.verify(token, process.env.jwt_secreat );
        req.user = decoded;

next();
    }
    catch(err){
        return res.status(401).json({
            message:"unauthorizeed",
            success:false,
            err:"invalid token"
        })
    }
 }
import { NextResponse } from "next/server";import { db } from "@/lib/db";
export const runtime="nodejs";
export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}){ const {id}=await ctx.params;const session=await db.session.findUnique({where:{id},include:{answers:{orderBy:{createdAt:"desc"}}}});if(!session)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json({session});}
export async function DELETE(_req:Request,ctx:{params:Promise<{id:string}>}){ const {id}=await ctx.params;await db.session.delete({where:{id}}).catch(()=>null);return NextResponse.json({ok:true});}

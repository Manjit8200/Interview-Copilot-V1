import { NextResponse } from "next/server";
import { z } from "zod";import { db } from "@/lib/db";
export const runtime="nodejs";
const schema=z.object({name:z.string().min(1).max(120),company:z.string().min(1).max(200),role:z.string().min(1).max(200),jobDescription:z.string().min(10).max(20000),resumeText:z.string().min(40).max(50000),resumeFileName:z.string().max(255)});
export async function GET(){ const sessions=await db.session.findMany({orderBy:{createdAt:"desc"},select:{id:true,name:true,company:true,role:true,resumeFileName:true,createdAt:true,_count:{select:{answers:true}}}});return NextResponse.json({sessions});}
export async function POST(req:Request){try{const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Please complete all fields and upload a valid resume."},{status:400});const session=await db.session.create({data:parsed.data});return NextResponse.json({session},{status:201});}catch{return NextResponse.json({error:"Could not save session."},{status:500});}}

import test from "node:test";
import assert from "node:assert/strict";
import { validateApplication } from "../src/lib/validation.ts";

const config={fields:[{key:"name",label:"Full name",type:"text",required:true},{key:"district",label:"District",type:"select",required:true,options:["Lahore","Faisalabad"]},{key:"tehsil",label:"Tehsil",type:"text",required:true,condition:{key:"district",equals:"Lahore"}}],documents:[]};
test("required fields and conditional fields are checked",()=>{
  assert.deepEqual(validateApplication(config,{name:"A",district:"Faisalabad"}).errors,[]);
  assert.match(validateApplication(config,{name:"A",district:"Lahore"}).errors.join(" "),/Tehsil/);
});
test("unknown fields and invalid choices are rejected or removed",()=>{
  const result=validateApplication(config,{name:"A",district:"Unknown",unlisted:"private"});
  assert.ok(result.errors.some(e=>e.includes("invalid choice")));
  assert.equal("unlisted" in result.data,false);
});
test("secret fields cannot be configured as ordinary form answers",()=>{
  assert.throws(()=>validateApplication({fields:[{key:"iris_password",label:"Password",type:"text",required:false}],documents:[]},{iris_password:"secret"}),/not permitted/);
});

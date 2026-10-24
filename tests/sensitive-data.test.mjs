import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {protectData,revealData} from "../src/lib/sensitive-data.ts";
test("identity numbers are encrypted and can be recovered with the server key",()=>{
  process.env.DATA_ENCRYPTION_KEY=randomBytes(32).toString("base64");
  const input={cnic:"12345-1234567-1",full_name:"A Client"};
  const stored=protectData(input);
  assert.notEqual(stored.cnic,input.cnic);
  assert.match(stored.cnic,/^enc:v1:/);
  assert.deepEqual(revealData(stored),input);
});

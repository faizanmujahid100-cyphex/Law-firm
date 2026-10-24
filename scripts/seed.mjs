import { db } from "./firebase-admin.mjs";

const reviewedAt = new Date("2026-10-24T00:00:00Z");
const workflow = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "IN_PROGRESS", "AWAITING_REVIEW", "COMPLETED"];
const services = [
  { slug: "punjab-domicile-assistance", title: "Punjab domicile certificate assistance", summary: "Guidance and document preparation for a Punjab domicile certificate request.", description: "We help review district-specific requirements and prepare documents. The competent authority makes the final decision.", jurisdiction: "Punjab, Pakistan", sourceUrl: "https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate", fields: [{ key: "full_name", label: "Applicant full name", type: "text", required: true }, { key: "identity_number", label: "CNIC or B-Form number", type: "text", required: true }, { key: "district", label: "District", type: "text", required: true }, { key: "address", label: "Residential address", type: "textarea", required: true }], documents: [{ key: "identity", label: "Applicant CNIC, B-Form or birth certificate as applicable", required: true }, { key: "residence", label: "Residence evidence accepted by relevant authority", required: false }] },
  { slug: "individual-tax-registration", title: "Individual income tax registration", summary: "Assistance with current FBR individual registration requirements.", description: "Our team reviews your circumstances and guides you through the authorized registration steps. We never ask for your IRIS password.", jurisdiction: "Pakistan", sourceUrl: "https://fbr.gov.pk/categ/register-income-tax/51147/30846/%2071149", fields: [{ key: "full_name", label: "Full legal name", type: "text", required: true }, { key: "cnic", label: "CNIC", type: "text", required: true }, { key: "mobile", label: "Mobile number", type: "text", required: true }, { key: "occupation", label: "Occupation or income source", type: "text", required: true }], documents: [{ key: "identity", label: "Identification document", required: true }] },
  { slug: "annual-income-tax-return", title: "Annual income tax return preparation", summary: "Preparation and review of a Pakistan income tax return for the applicable tax year.", description: "We prepare a draft for review and record filing acknowledgment only after genuine submission through FBR IRIS.", jurisdiction: "Pakistan", sourceUrl: "https://fbr.gov.pk/categ/file-income-tax-return/51147/80860/71160", fields: [{ key: "full_name", label: "Full legal name", type: "text", required: true }, { key: "cnic", label: "CNIC", type: "text", required: true }, { key: "tax_year", label: "Tax year", type: "text", required: true }, { key: "income_source", label: "Income sources", type: "textarea", required: true }], documents: [{ key: "identity", label: "Identification document", required: true }] },
];

const settings = db.collection("firmSettings").doc("default");
if (!(await settings.get()).exists) await settings.create({ name: "Amanah Legal", tagline: "Clarity for every legal step", about: "A client-focused legal office serving individuals and businesses in Pakistan.", mission: "To make legal and administrative services understandable, accountable and secure.", address: "", phone: "", email: "", hours: "", privacy: "We collect information needed to provide requested services. Contact the office for access or deletion requests, subject to lawful retention.", terms: "Services begin after the office accepts a request. Fees and timelines are confirmed for each matter.", disclaimer: "Website information is general guidance. Government requirements may change.", updatedAt: new Date() });
for (const service of services) {
  const existing = await db.collection("services").where("slug", "==", service.slug).limit(1).get();
  if (!existing.empty) continue;
  const { fields, documents, ...details } = service;
  const serviceRef = db.collection("services").doc();
  const versionRef = db.collection("serviceVersions").doc();
  const batch = db.batch();
  batch.set(serviceRef, { ...details, published: true, featured: true, feePkr: null, estimate: "Confirmed after review", reviewedAt, createdAt: new Date(), updatedAt: new Date() });
  batch.set(versionRef, { serviceId: serviceRef.id, version: 1, form: fields, requirements: documents, workflow, createdAt: new Date() });
  await batch.commit();
}
console.log("Configurable service templates and firm settings seeded. No client, payment or application records created.");

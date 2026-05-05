export interface BudgetLineTemplate {
  divCode: string
  divName: string
  itemCode: string
  description: string
  unit: string
  vendor: string
  valorInicial: number
}

export const BUDGET_LINES_TEMPLATE: BudgetLineTemplate[] = [
  // ── DIV 01 ────────────────────────────────────────────
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'00.03', description:'Zoning Analysis', unit:'LS', vendor:'Self / Surveyor', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'00.04', description:'Soil Study / Geotechnical', unit:'LS', vendor:'Geotechnical Engineer', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'00.05', description:'Utility Feasibility', unit:'LS', vendor:'Self / Utility companies', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'00.06', description:'HOA Validation Chickasaw', unit:'LS', vendor:'Self', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'00.07', description:'Pre-Purchase Financial Model', unit:'LS', vendor:'Self', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.01', description:'Topographic Survey', unit:'LS', vendor:'Licensed Surveyor SC', valorInicial:3000 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.02', description:'Architectural Design / Blueprints', unit:'LS', vendor:'HPZ Plans / Architect', valorInicial:3500 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.03', description:'GC Fee (Project Management)', unit:'LS', vendor:'AMA, LLC', valorInicial:12000 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.08', description:'ACC Approval (Chickasaw)', unit:'LS', vendor:'Chickasaw ACC', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.09', description:'Color/Material Approval ACC', unit:'LS', vendor:'Chickasaw ACC', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.10', description:'Drainage Plan Submission', unit:'LS', vendor:'Civil Engineer', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.11', description:'Landscaping Plan Submission', unit:'LS', vendor:'Landscape designer', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.12', description:'Chickasaw Utility Approval', unit:'LS', vendor:'Chickasaw Utility', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'04.13', description:'24h POA Notification (Pre-Pour)', unit:'LS', vendor:'Chickasaw POA', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.01', description:'Temporary Power Pole', unit:'LS', vendor:'Licensed Electrician', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.02', description:'Temp Power Approval', unit:'LS', vendor:'Blue Ridge Electric', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.03', description:'Portable Toilet', unit:'MO', vendor:'Local porta-john', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.04', description:'811 Utility Locate Call', unit:'LS', vendor:'SC811', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.05', description:'Termite Pre-Treatment', unit:'LS', vendor:'Licensed pest control', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.06', description:'Site Address Numbers Posted', unit:'LS', vendor:'Self', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.07', description:'Construction Signage', unit:'LS', vendor:'Self / GC', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.08', description:'Security Cameras (Optional)', unit:'LS', vendor:'Self', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'05.09', description:'Storage Container / Job Box', unit:'LS', vendor:'Self / GC', valorInicial:0 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'06.01', description:'Lot Clearing', unit:'LS', vendor:'Excavator / Site contractor', valorInicial:20000 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'06.02', description:'Grading', unit:'LS', vendor:'Excavator/Grader', valorInicial:14100 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'06.03', description:'Temporary Gravel Driveway', unit:'LS', vendor:'Contractor', valorInicial:5400 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'06.04', description:'Silt Fence', unit:'LF', vendor:'Site contractor', valorInicial:1500 },
  { divCode:'DIV 01', divName:'Site Work & Pre-Construction', itemCode:'06.05', description:'Setback Verification', unit:'LS', vendor:'Surveyor', valorInicial:0 },

  // ── DIV 02 ────────────────────────────────────────────
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.01', description:'Excavation and Compaction', unit:'LS', vendor:'Excavator', valorInicial:9400 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.02', description:'Slab Framing (Forms)', unit:'LS', vendor:'Concrete contractor', valorInicial:1900 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.03', description:'Fill Dirt', unit:'CY', vendor:'Dirt supplier', valorInicial:2400 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.04', description:'Gravel Base', unit:'CY', vendor:'Stone supplier', valorInicial:3500 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.05', description:'Underground Plumbing', unit:'LS', vendor:'Plumber', valorInicial:4700 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.06', description:'Slab Construction', unit:'LS', vendor:'Concrete contractor', valorInicial:18000 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.07', description:'Crawlspace Walls / Foundation', unit:'LS', vendor:'Foundation contractor', valorInicial:39600 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.08', description:'Footing Inspection (County)', unit:'LS', vendor:'Oconee County Inspector', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.09', description:'Foundation Steel Inspection', unit:'LS', vendor:'Oconee County Inspector', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.10', description:'Plumbing Under Slab Inspection', unit:'LS', vendor:'Oconee County Inspector', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.11', description:'Electrical Under Slab Inspection', unit:'LS', vendor:'Oconee County Inspector', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.12', description:'Pre-Slab Inspection', unit:'LS', vendor:'Oconee County Inspector', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.13', description:'Foundation / Damp Proofing', unit:'LS', vendor:'Foundation contractor', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.14', description:'J-Bolts / Anchor Bolts', unit:'LS', vendor:'Foundation contractor', valorInicial:0 },
  { divCode:'DIV 02', divName:'Foundation', itemCode:'07.15', description:'24h HOA Notification (Pre-Pour)', unit:'LS', vendor:'Chickasaw POA', valorInicial:0 },

  // ── DIV 03 ────────────────────────────────────────────
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.01', description:'Lumber and Materials', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.02', description:'Framing Labor', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.03', description:'Floor System / Joists', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.04', description:'Wall Framing', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.05', description:'Roof Trusses Install', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.06', description:'Roof Sheathing', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.07', description:'Wall Sheathing / Zip System', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.08', description:'Exterior Pan Flashing', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.09', description:'Stairs Framing', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 03', divName:'Framing & Structural', itemCode:'08.10', description:'Fire Blocking / Draft Stopping', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 04 ────────────────────────────────────────────
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.01', description:'Roofing', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.02', description:'Siding', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.03', description:'Windows', unit:'EA', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.04', description:'Exterior Paint', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.05', description:'External Doors', unit:'EA', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.06', description:'Garage Door + Opener', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.07', description:'Gutters / Downspouts', unit:'LF', vendor:'', valorInicial:0 },
  { divCode:'DIV 04', divName:'Exterior Envelope', itemCode:'09.08', description:'Envelope / Roof Inspection', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 05 ────────────────────────────────────────────
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.01', description:'Plumbing Rough-In', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.02', description:'HVAC Rough-In', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.03', description:'Electrical Rough-In', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.04', description:'HVAC Final / Equipment Install', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.05', description:'Grinder Pump Install', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.06', description:'Gas Line Install (if NatGas)', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.07', description:'Framing/Rough Inspection', unit:'LS', vendor:'Oconee County', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.08', description:'CAFCI Circuits Per Room', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.09', description:'GFCI Receptacles', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 05', divName:'MEP Rough-In & Final', itemCode:'10.10', description:'Smoke / CO Detectors', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 06 ────────────────────────────────────────────
  { divCode:'DIV 06', divName:'Insulation & Drywall', itemCode:'11.01', description:'Insulation Walls/Ceiling', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 06', divName:'Insulation & Drywall', itemCode:'11.02', description:'Insulation Behind Tubs/Showers', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 06', divName:'Insulation & Drywall', itemCode:'11.03', description:'Drywall Hang', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 06', divName:'Insulation & Drywall', itemCode:'11.04', description:'Drywall Finish / Tape', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 07 ────────────────────────────────────────────
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.01', description:'Trims / Internal Doors', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.02', description:'Closets', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.03', description:'Interior Paint', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.04', description:'Mirrors', unit:'EA', vendor:'', valorInicial:0 },
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.05', description:'Lighting Fixtures', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 07', divName:'Interior Finishes', itemCode:'12.06', description:'Crown Molding', unit:'LF', vendor:'', valorInicial:0 },

  // ── DIV 08 ────────────────────────────────────────────
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'13.01', description:'Cabinetry & Countertops Materials', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'13.02', description:'Cabinetry & Countertops Labor', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'13.03', description:'Backsplash', unit:'SF', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'13.04', description:'Island Setup', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'14.01', description:'Flooring (LVP / Tile)', unit:'SF', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'14.02', description:'Underlayment', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'14.03', description:'Transitions / Reducers', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.01', description:'Bathroom Fixtures', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.02', description:'Kitchen / Laundry Fixtures', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.03', description:'Vanities', unit:'EA', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.04', description:'Tiling Bathrooms', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.05', description:'Shower Doors', unit:'EA', vendor:'', valorInicial:0 },
  { divCode:'DIV 08', divName:'Kitchen, Bath & Flooring', itemCode:'15.06', description:'Shower Walls', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 09 ────────────────────────────────────────────
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'16.01', description:'Kitchen Appliances', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'16.02', description:'Washer / Dryer', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'16.03', description:'Appliance Install Labor', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'16.04', description:'Fireplace', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.01', description:'Landscaping', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.02', description:'Driveway / Walkways', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.03', description:'Outdoor Lighting', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.04', description:'Deck', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.05', description:'Final Clean Up', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 09', divName:'Appliances & Final Site', itemCode:'17.06', description:'Fencing', unit:'LS', vendor:'', valorInicial:0 },

  // ── DIV 10 ────────────────────────────────────────────
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'01.03', description:'Origination Fee', unit:'LS', vendor:'Lender', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'01.04', description:'Underwriting Fee', unit:'LS', vendor:'Lender', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'01.10', description:'Interest Reserve', unit:'LS', vendor:'Lender', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'02.01', description:"Builder's Risk Insurance", unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'02.02', description:'General Liability (GL)', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'02.05', description:'Workers Compensation', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'04.04', description:'County Building Permit', unit:'LS', vendor:'Oconee County', valorInicial:5000 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'04.05', description:'HOA Building Permit (Chickasaw)', unit:'LS', vendor:'Chickasaw POA', valorInicial:15200 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'04.06', description:'Water TAP Permit', unit:'LS', vendor:'', valorInicial:3000 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'04.07', description:'Electric Power TAP Permit', unit:'LS', vendor:'Blue Ridge Electric', valorInicial:3500 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'18.01', description:'Final Building Inspection', unit:'LS', vendor:'Oconee County', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'18.05', description:'Certificate of Occupancy (CO)', unit:'LS', vendor:'Oconee County', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'19.01', description:'Punch List Completion', unit:'LS', vendor:'', valorInicial:0 },
  { divCode:'DIV 10', divName:'Soft Costs (Permits, Insurance, Financing, Closing)', itemCode:'19.05', description:'Final Draw Release', unit:'LS', vendor:'Hera Holdings', valorInicial:0 },
]

// Service availability confirmed by Bjørn in this chat, 2026-11-04.
// Screenshots plus explicit diesel/petrol/automatic lists confirmed 2026-11-06.
// Credit prices/totals omitted; generic enquiries never confirm compatibility.
// Listing a service does not establish vehicle support, scope or a customer price.
export const businessServices = [
  {group:'Motor og bil',services:[
    ['engine-stage-1','Stage 1','Stage 1',null,{priority:10}],
    ['engine-stage-2','Stage 2','Stage 2',{fuels:['petrol'],priority:10},{priority:20}],
    ['engine-stage-3','Stage 3','Stage 3'],
    ['egr','EGR-deaktivering','EGR delete',{fuels:['diesel'],systemUnlessAbsent:'egr',priority:10},{fuels:['diesel'],systemUnlessAbsent:'egr',priority:30}],
    ['dpf','DPF-deaktivering','DPF delete',{fuels:['diesel'],systemUnlessAbsent:'dpf',priority:20},{fuels:['diesel'],systemUnlessAbsent:'dpf',priority:40}],
    ['gpf-opf','GPF/OPF-deaktivering','GPF/OPF Delete',{fuels:['petrol'],system:'gpf',priority:30}],
    ['adblue','AdBlue-deaktivering','AdBlue off',{fuels:['diesel'],system:'adblue',priority:30},{fuels:['diesel'],system:'adblue',priority:50}],
    ['decat','Katalysatortilpassing','Decat',{fuels:['petrol'],system:'catalyst',priority:70}],
    ['vmax','Fjerning av fartssperre','Vmax',{fuels:['diesel','petrol'],priority:60}],
    ['dtc','DTC-deaktivering','DTC remove',{fuels:['diesel'],priority:65},{fuels:['diesel'],priority:60}],
    ['pop-bang','Eksos-burbles','Pop & Bang / Hardcut',{fuels:['petrol'],priority:40}],
    ['hardcut','Hardcut-turtalssperre','Pop & Bang / Hardcut',{fuels:['diesel'],priority:40}],
    ['sai','SAI-deaktivering','SAI delete',{fuels:['petrol'],system:'sai',priority:80}],
    ['a-tractor-epa','A-traktor / EPA, maks. 30 km/t','A-tractor / EPA max 30km/h'],
    ['oil-pressure-vag','Oljetrykk VAG 3.0 TDI – Euro 6','Oil pressure VAG',{fuels:['diesel'],vagThreeLitre:true,reviewVariant:true,yearFrom:2011,priority:85}],
    ['original','Original programvare','Original',{priority:90},{priority:70}],
    ['checksum','Kontrollsum (Checksum)','Checksum'],
    ['swirl-flaps','Innsugsspjeld','Swirl Flaps',{fuels:['diesel'],system:'swirlFlaps',priority:70}],
    ['hot-start-cold','Varm-/kaldstarttilpassing','Hot start / cold'],
    ['cold-start','Kaldstart-deaktivering','Cold start delete',{fuels:['petrol'],priority:65}],
    ['maf','MAF-deaktivering','MAF off',{fuels:['petrol'],priority:85}],
    ['start-stop','Start/stopp-deaktivering','Start / stop system off',{fuels:['diesel'],system:'startStop',priority:45}],
    ['anti-lag','Antilag','Anti lag',{fuels:['petrol'],turbo:true,priority:80}],
    ['launch-control','Launch control','Launch control',{fuels:['petrol'],priority:70}],
    ['performance-gauge','Effektvising BMW / MINI','Performance gauge BMW / MINI',{makes:['bmw','mini'],priority:50}],
    ['cylinder-on-demand','Sylinderutkopling','Cylinder on demand',{fuels:['petrol'],system:'cylinderOnDemand',priority:70}],
    ['e85','E85-konvertering','E85 Conversion',{fuels:['petrol'],priority:20}],
    ['mapswitch','Multi-map (Mapswitch)','Mapswitch',{fuels:['diesel','petrol'],priority:50}],
  ]},
  {group:'Girkasse',services:[
    ['gearbox-stage-1','Girkasse steg 1','Stage 1',{automatic:true,priority:35}],
    ['gearbox-stage-2','Girkasse steg 2','Stage 2',{automatic:true,priority:75}],
    ['internal-torque','Momentoppsett i girkassa','Internal torque',{automatic:true,priority:80}],
    ['no-shift-manual','Hald valt gir','No shift in manual',{automatic:true,priority:80}],
    ['modified-take-off','Igangkøyring','Modified take-off',{automatic:true,priority:85}],
    ['launch-control-rpm','Launch control RPM','Launchcontrol RPM',{automatic:true,system:'launchControl',priority:85}],
    ['custom-max-rpm','Maksturtal i køyremodus','Custom max RPM D+S+M',{automatic:true,system:'drivingModesDSM',priority:85}],
    ['clutch-pressure','Clutchtrykk','Clutch pressure increase',{automatic:true,priority:85}],
    ['shifting-speed','Girskifthastigheit','Shifting speed D+S+M',{automatic:true,system:'drivingModesDSM',priority:85}],
  ]},
].map(group=>Object.freeze({...group,services:Object.freeze(group.services.map(([id,label,supplierLabel,eligibility,heavyEligibility])=>Object.freeze({id,label,supplierLabel,customerOption:!!eligibility||!!heavyEligibility,eligibility:eligibility?Object.freeze(eligibility):null,heavyEligibility:heavyEligibility?Object.freeze(heavyEligibility):null})))}));
Object.freeze(businessServices);


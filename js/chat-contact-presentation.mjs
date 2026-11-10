export function contactPresentation(overview={}){
 const hasVehicle=overview.hasVehicle===true;
 return {hasVehicle,title:hasVehicle?'Få tilbod frå Bjørn':'Få svar frå Bjørn',
  explanation:hasVehicle?'Bjørn vurderer opplysningane og vala dine, og tek kontakt på e-post eller mobil. Du får eit individuelt tilbod.':'Du kan kontakte oss utan å gjere eit val. Vi legg ved samtalen dersom du har skrive med assistenten.',
  messageLabel:hasVehicle?'Melding (valfritt)':'Kva kan vi hjelpe deg med? (valfritt)',
  extrasTitle:hasVehicle?'Namn og melding (valfritt)':'Namn (valfritt)',
  attachmentNote:hasVehicle?'Bjørn får dei tekniske opplysningane, vala dine og heile samtalen.':'Kontaktopplysninga, eventuell melding og samtalen blir lagde ved.'};
}

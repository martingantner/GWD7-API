import { faker } from '@faker-js/faker';

export function createPersonGroupPayload() {
  return {
       isInactive: false,
       personalId:0,
       personalNumber:815,
       personGroupId:1,
       firstName: faker.person.firstName(),
       lastName: faker.person.lastName(),
       displayName:"",
       title:"Dr.",
       gender:1,
       pinCode: "1234",
       phoneNumber:"",
       validFrom:null,
       validUntil:null,
       dataCarriers:[],
       fingerprints:[],
       optionalFieldValues:[],
       isPINCodeSet:false,
       poolGroupId:null,
       personStatus:0,
       dataCarriersToBlacklist:[],
       email: faker.internet.email,
       updatePinCode:true
  };
}

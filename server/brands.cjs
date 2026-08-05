const BRANDS = {
  neoskills: {
    key: 'neoskills',
    name: 'Neoskills Learning Solutions',
    address: '4th floor, Office no-402, Yugal Parnavi, Sai Chowk Rd, near Irani cafe, Laxman Nagar, Baner, Pune, Maharashtra 411045',
    phone: '9975214585',
    pan: 'AAYFN4318E',
    contact: 'account@neoskills.co.in',
    website: 'www.neoskills.co.in',
  },
  careervue: {
    key: 'careervue',
    name: 'CareerVUE',
    address: '4th floor, Office no-402, Yugal Parnavi, Sai Chowk Rd, near Irani cafe, Laxman Nagar, Baner, Pune, Maharashtra, 411045',
    phone: '9975214585',
    pan: 'AAPHK5661J',
    contact: 'account@neoskills.co.in',
    website: 'CareerVue: www.neoskills.co.in',
  },
  frolics: {
    key: 'frolics',
    name: 'Frolics Solutions',
    address: 'Frolics floor, Office no-402, Yugal Parnavi, Sai Chowk Rd, near Irani cafe, Laxman Nagar, Baner., Pune, Maharashtra, 411045',
    phone: '9975214585',
    pan: 'AVYPP9576D',
    contact: 'account@neoskills.co.in',
    website: 'Neoskills: www.neoskills.co.in',
  },
};

function getBrand(key) {
  return BRANDS[key] || BRANDS.neoskills;
}

module.exports = { BRANDS, getBrand };

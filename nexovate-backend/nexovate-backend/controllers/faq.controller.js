// controllers/faq.controller.js
const faqService = require('../services/faq.service');

const getFAQs = async (req, res) => {
  try {
    const faqs = await faqService.getActiveFAQs();
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQs', error });
  }
};

module.exports = {
  getFAQs,
};

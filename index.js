'use strict';

const cheerio = require('cheerio');
const rp = require('request-promise');
const fs = require('fs');
const path = process.argv[2];

const partsHtml = fs.readFileSync(path, 'utf8', (err, contents) => contents.trim())

function parseLinks(html) {
  let $ = cheerio.load(html);

  // The links are located in here.
  let links = $('.manual-zebra tbody').find('tr .price.nowrap a');
  let hrefs = [];

  // Compose the urls
  links.each(function () {
    hrefs.push(`http://pcpartpicker.com${($(this).attr('href'))}`);
  })

  return hrefs;
}

function parsePrices(html) {
  let $ = cheerio.load(html);

  let prices = $('.tr.price.nowrap a').text().trim().split('$');

  // Remove the blank element at the beginning, since we split it
  // by the $ sign, and then convert the strings to numbers.
  return prices.filter(element => element !== '').map(price => parseFloat(price));
}

async function getWeight(url) {
  const options = {
    url,
    transform: (body) => {
      return cheerio.load(body);
    }
  };

  let $ = await rp(options);
  let weight = $('body')
  .find(`.a-color-secondary.a-size-base.prodDetSectionEntry:contains(Shipping Weight)`)
  .siblings().first().html().trim().split(' ').slice(0, 2);

  return new Promise(resolve => resolve({
    number: parseFloat(weight[0]),
    unit: weight[1]
  }));
}

async function getWeights(links) {
  let weights = [];
  for(const link of links) {
    let weight = await getWeight(link);
    weights.push(weight);
    console.log(`${link} is done.`)
  }

  return weights;
}


async function compose(html) {
  let links = parseLinks(html)
  let prices = parsePrices(html);
  let weights = await getWeights(links);

  let composed = [];
  for (let i = 0; i < links.length; i++) {
    composed.push({
      link: links[i],
      price: prices[i],
      weight: weights[i]
    });
  }

  return composed;
}


compose(partsHtml).then(parts => {
  let total = 0;
  parts.map(part => {
    let totalCost = 0;
    if(part.weight.unit === 'ounces') {
      totalCost = part.price + 7;
    } else {
      totalCost = (part.weight.number * 7) + part.price;
    }
    total = totalCost + total;
  });

  console.log(`Your total shipping cost is: $${Math.ceil(total)}`);
});
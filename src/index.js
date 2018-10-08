const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const config = {
  username: '17090879436',
  password: 'qcc7243',
  saveAllSubPage: true
}

if (!fs.existsSync(path.resolve(__dirname, '..', 'data'))) {
  fs.mkdirSync(path.resolve(__dirname, '..', 'data'))
}

const host = 'https://www.qichacha.com'
const dataPath = path.resolve(__dirname, '..', 'data')

main()

async function main () {
  /**
   * 输入密码, 验证码你来解决
   */
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] }) // args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await goToLoginPage(page, config)
  await sleep(12000)
  /**
   * 看看需不需要验证码
   */
  await page.goto('https://www.qichacha.com/firm_9cce0780ab7644008b73bc2120479d31.html')
  await sleep(8000)
  /**
   * companyInfo 是你要爬的公司, 确保 id 和 url 在, 格式你可以自己看看
   */
  const companyInfo = require('./companyInfo')
  for (const [idx, company] of companyInfo.entries()) {
    console.log(`${idx + 1} / ${companyInfo.length} : ${company.name}`)
    await saveCompanyPage(company, page)
    await saveTouziList(company, page)
    await saveManyPage(company, page)
  }
}

async function saveCompanyPage (company, page) {
  if (!fs.existsSync(path.resolve(dataPath, company.id + '.html'))) {
    await sleep(4000)
    try {
      const pageHTML = await fetchCompanyPage(company, page)
      if (pageHTML.length < 25000) throw Error('这个页数内容太少了, 或许有什么问题')
      fs.writeFileSync(path.resolve(dataPath, company.id + '.html'), pageHTML)
    } catch (err) {
      console.log(err)
      await sleep(30000)
    }
  }
}

async function saveManyPage (company, page) {
  if (!config.saveAllSubPage) return
  const unique = company.url.slice(6, company.url.length - 5)
  if (!fs.existsSync(path.resolve(dataPath, company.id + '_run.html'))) {
    try {
      await sleep(4000)
      console.log('保存经营页面')
      await page.goto(`https://www.qichacha.com/company_getinfos?unique=${unique}&companyname=河北&tab=run`)
      const pageHTML = await page.content()
      if (pageHTML.length < 20) {
        throw new Error('经营页面没东西... 奇怪, 反正这样我不能存下来')
      } else if (pageHTML.length > 80000) {
        throw new Error('页面太长了, 可能是你没登录吧, 反正这样我不能存下来')
      }
      fs.writeFileSync(path.resolve(dataPath, `${company.id}_run.html`), pageHTML)
    } catch (err) {
      console.log(err)
      await sleep(8000)
    }
  } else {
    console.log('经营页面exists')
  }
  if (!fs.existsSync(path.resolve(dataPath, company.id + '_assets.html'))) {
    try {
      await sleep(4000)
      console.log('保存专利页面')
      await page.goto(`https://www.qichacha.com/company_getinfos?unique=${unique}&companyname=河北&tab=assets`)
      const pageHTML = await page.content()
      if (pageHTML.length < 20) {
        throw new Error('专利页面没东西... 奇怪, 反正这样我不能存下来')
      } else if (pageHTML.length > 80000) {
        throw new Error('页面太长了, 可能是你没登录吧, 反正这样我不能存下来')
      }
      fs.writeFileSync(path.resolve(dataPath, `${company.id}_assets.html`), pageHTML)
    } catch (err) {
      console.log(err)
      await sleep(8000)
    }
  } else {
    console.log('专利页面exists')
  }
}

async function saveTouziList (company, page) {
  async function getPage (id) {
    const cp = path.resolve(dataPath, id + '.html')
    const companyPage = fs.readFileSync(cp).toString()
    const $ = cheerio.load(companyPage)
    if ($('#touzilist .tbadge') == null) {
      console.log('这个公司没有对外投资')
      return -1
    }
    let n = Number($('#touzilist .tbadge').text())
    n = parseInt(n / 10, 10) + (n % 10 == 0 ? 0 : 1)
    return n
  }
  const unique = company.url.slice(6, company.url.length - 5)
  try {
    if (!fs.existsSync(path.resolve(dataPath, company.id + '.html'))) {
      console.log('没找到公司页面, 不下载投资页了')
    } else {
      console.log('已存在')
      const n = await getPage(company.id)
      if (n == -1) return
      console.log(`有${n}个对外投资`)
      for (let i = 1; i <= n; ++i) {
        if (fs.existsSync(path.resolve(dataPath, `${company.id}_touzi_${i}.html`))) {
          console.log(`${company.id}_touzi_${i}.html 已存在`)
          continue
        }
        await sleep(4000)
        await page.goto(`https://www.qichacha.com/company_getinfos?unique=${unique}&companyname=河北&p=${i}&tab=base&box=touzi`)
        const pageHTML = await page.content()
        if (pageHTML.length < 20) {
          console.log('投资页面没东西... 奇怪, 反正这样我不能存下来')
          continue
        } else if (pageHTML.length > 50000) {
          console.log('页面太长了, 可能是你没登录吧, 反正这样我不能存下来')
        }
        fs.writeFileSync(path.resolve(dataPath, `${company.id}_touzi_${i}.html`), pageHTML)
      }
    }
  } catch (err) {
    console.log(err)
    console.log('下载投资页面出错了... 我也不知道会遇到什么错误')
  }
}

async function goToLoginPage (page) {
  await page.goto(host)
  await page.goto('https://www.qichacha.com/user_login')
  await page.evaluate((config) => {
    document.querySelector('#normalLogin').click()
    document.querySelector('#nameNormal').value = config.username
    document.querySelector('#pwdNormal').value = config.password
  }, config)
}

/**
 * @param {string} url 
 * @param {puppeteer.page} page 
 */
async function fetchPage (url, page) {
  await page.goto(host + url)
  const pageHTML = await page.content()
  return pageHTML
}

/**
 * @param {object} company
 * @param {string} company.id 
 * @param {string} company.url
 * @param {puppeteer.page} page
 */
async function fetchCompanyPage (company, page) {
  await page.goto(host + company.url)
  const pageHTML = await page.content()
  return pageHTML
}

/**
 * @param {number} ms 
 */
async function sleep (ms) {
  await new Promise(res => {
    setTimeout(res, ms)
  })
}
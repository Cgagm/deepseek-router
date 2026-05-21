// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href')
    if (href === '#') return
    e.preventDefault()
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  })
})

// Nav shadow on scroll
const nav = document.querySelector('.nav')
window.addEventListener('scroll', () => {
  if (window.scrollY > 0) {
    nav.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'
  } else {
    nav.style.boxShadow = 'none'
  }
})

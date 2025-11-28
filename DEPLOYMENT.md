# AfroDex Deployment Guide

This guide will help you deploy AfroDex to production.

## Prerequisites Checklist

Before deploying, make sure you have:

- [ ] GitHub account
- [ ] Vercel account (free tier is fine)
- [ ] Alchemy API key
- [ ] WalletConnect Project ID
- [ ] All token logo images ready
- [ ] Domain name (optional, but recommended)

## Step-by-Step Deployment

### 1. Prepare Your Repository

1. **Create a new GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AfroDex modern DEX"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/afrodex-modern.git
   git push -u origin main
   ```

2. **Add token images**
   - Add all token logos to `public/tokens/`
   - Ensure `empty-token.png` exists as a fallback
   - Verify all images are optimized (< 50KB each)

### 2. Get Required API Keys

#### Alchemy API Key
1. Go to [Alchemy](https://www.alchemy.com/)
2. Sign up / Log in
3. Create a new app
   - Chain: Ethereum
   - Network: Mainnet
4. Copy your API key

#### WalletConnect Project ID
1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Sign up / Log in
3. Create a new project
4. Copy your Project ID

#### Supabase (Optional)
1. Go to [Supabase](https://supabase.com/)
2. Create a new project
3. Copy your URL and anon key

### 3. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard

1. **Import Repository**
   - Go to [Vercel](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub account
   - Select the `afrodex-modern` repository

2. **Configure Environment Variables**
   
   In Vercel project settings, add:
   
   ```
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   NEXT_PUBLIC_EXCHANGE_CONTRACT=0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56
   NEXT_PUBLIC_CHAIN_ID=1
   ```

3. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your site will be live at `your-project.vercel.app`

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
vercel env add NEXT_PUBLIC_EXCHANGE_CONTRACT
vercel env add NEXT_PUBLIC_CHAIN_ID

# Deploy to production
vercel --prod
```

### 4. Configure Custom Domain

1. **In Vercel Dashboard**
   - Go to Project Settings
   - Click "Domains"
   - Add your domain (e.g., `dex.afrox.one`)

2. **Update DNS Records**
   
   Add the following records to your DNS:
   
   ```
   Type: A
   Name: @ (or your subdomain)
   Value: 76.76.21.21
   
   Type: CNAME
   Name: www (or your subdomain)
   Value: cname.vercel-dns.com
   ```

3. **Wait for Propagation**
   - DNS changes can take up to 48 hours
   - Vercel will auto-provision SSL certificate

### 5. Post-Deployment Checklist

- [ ] Test wallet connection
- [ ] Verify all trading pairs load correctly
- [ ] Test deposit/withdraw functionality
- [ ] Check order placement
- [ ] Verify chart data loads
- [ ] Test on mobile devices
- [ ] Check all token logos display correctly
- [ ] Test custom token addition feature

### 6. Monitoring & Analytics

#### Set up Vercel Analytics
1. In Vercel dashboard, enable Analytics
2. View real-time traffic and performance

#### Optional: Supabase for Trade Analytics
1. Create tables for trade tracking
2. Add API routes to log trades
3. Build analytics dashboard

### 7. Continuous Deployment

Vercel will automatically deploy when you push to main:

```bash
# Make changes
git add .
git commit -m "Update: feature description"
git push origin main

# Vercel automatically builds and deploys!
```

## Production Optimization

### Performance

1. **Image Optimization**
   ```bash
   # Optimize all token images
   npm install -g imagemin-cli
   imagemin public/tokens/*.png --out-dir=public/tokens
   ```

2. **Enable Edge Caching**
   - Vercel automatically handles this
   - Consider using Vercel Edge Config for dynamic data

3. **Enable Compression**
   - Already enabled by Next.js/Vercel

### Security

1. **Environment Variables**
   - Never commit `.env.local` to git
   - Use Vercel's encrypted environment variables
   - Rotate API keys regularly

2. **Rate Limiting**
   - Consider implementing rate limiting for API calls
   - Use Vercel's edge middleware for protection

3. **Content Security Policy**
   - Add CSP headers in `next.config.js`:
   ```javascript
   async headers() {
     return [
       {
         source: '/(.*)',
         headers: [
           {
             key: 'Content-Security-Policy',
             value: "default-src 'self'; ..."
           }
         ]
       }
     ]
   }
   ```

### SEO

1. **Add metadata** in `app/layout.tsx`
2. **Create sitemap.xml**
3. **Add robots.txt**
4. **Submit to search engines**

## Troubleshooting

### Build Fails
- Check all dependencies are installed
- Verify Node.js version (18+)
- Check environment variables are set

### Runtime Errors
- Check browser console for errors
- Verify API keys are correct
- Ensure contract address is correct

### Slow Performance
- Check Alchemy rate limits
- Consider upgrading to paid Alchemy plan
- Enable Vercel Pro for better performance

## Maintenance

### Regular Tasks
- Monitor error logs in Vercel dashboard
- Update dependencies monthly: `npm update`
- Check for Next.js updates
- Monitor gas prices for user experience
- Update token list as needed

### Emergency Rollback
```bash
# Roll back to previous deployment
vercel rollback
```

## Support

- GitHub Issues: Report bugs and feature requests
- Email: support@afrox.one
- Discord: Join AfroDex community

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Alchemy Documentation](https://docs.alchemy.com/)
- [WalletConnect Docs](https://docs.walletconnect.com/)

---

**Congratulations! Your AfroDex is now live! 🚀**

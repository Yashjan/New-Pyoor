import numpy as np
from PIL import Image, ImageFilter
rng=np.random.default_rng(5)
def load(f,box):
    a=np.asarray(Image.open(f).convert('RGB').crop(box)).astype(np.float32)
    p=np.percentile(a.reshape(-1,3),92,0); a=a*(np.array([238,235,229])/p)   # neutral off-white
    return np.clip(a,0,255)
S=[load('s1_hi.png',(140,128,564,552)), load('s2_hi.png',(140,110,564,534))]
src=[]
for a in S:
    im=Image.fromarray(a.clip(0,255).astype(np.uint8))
    for ang in range(0,360,15):
        r=np.asarray(im.rotate(ang,Image.BICUBIC)).astype(np.float32)
        c=int(424*0.5/ (abs(np.cos(np.radians(ang%90)))+abs(np.sin(np.radians(ang%90)))))  # inscribed half-size
        m=212; src.append(r[m-c:m+c, m-c:m+c])

P,O=270,64; st=P-O
def cut_v(err):  # min-error vertical seam, err HxO -> mask HxO (True = new patch)
    h,w=err.shape; E=err.copy(); B=np.zeros((h,w),int)
    for i in range(1,h):
        for j in range(w):
            lo,hi=max(0,j-1),min(w,j+2); k=lo+int(np.argmin(E[i-1,lo:hi])); B[i,j]=k; E[i,j]+=E[i-1,k]
    m=np.zeros((h,w),bool); j=int(np.argmin(E[-1]))
    for i in range(h-1,-1,-1): m[i,j:]=True; j=B[i,j]
    return m
def quilt(W,H):
    nx=(W-O)//st+1; ny=(H-O)//st+1
    out=np.zeros((ny*st+O,nx*st+O,3),np.float32)
    for y in range(ny):
        for x in range(nx):
            Y,X=y*st,x*st; best=None
            cands=[]
            for _ in range(900):
                s=src[rng.integers(len(src))]; sy=rng.integers(0,s.shape[0]-P); sx=rng.integers(0,s.shape[1]-P)
                c=s[sy:sy+P,sx:sx+P]; e=0
                if x: e+=((c[:,:O]-out[Y:Y+P,X:X+O])**2).sum()
                if y: e+=((c[:O,:]-out[Y:Y+O,X:X+P])**2).sum()
                cands.append((e,c))
            emin=min(e for e,_ in cands); ok=[c for e,c in cands if e<=emin*1.4+1]
            c=ok[rng.integers(len(ok))]; mask=np.ones((P,P),bool)
            if x: mask[:,:O]&=cut_v(((c[:,:O]-out[Y:Y+P,X:X+O])**2).sum(2))
            if y: mask[:O,:]&=cut_v(((c[:O,:]-out[Y:Y+O,X:X+P])**2).sum(2).T).T
            from scipy.ndimage import gaussian_filter
            mf=gaussian_filter(mask.astype(np.float32),1.6)[...,None]
            if not (x or y): mf=np.ones((P,P,1),np.float32)
            out[Y:Y+P,X:X+P]=out[Y:Y+P,X:X+P]*(1-mf)+c*mf
    return out[:H,:W]
img=quilt(3600,2400)
L=img.mean(2,keepdims=True)
img=L+(img-L)*0.6                              # tame the pink cast from the red cloth, keep it warm
img=img*np.array([1.0,0.99,0.965])             # warm off-white like the real salt
x=img/255; x=x+0.18*(x-0.5)*(1-np.abs(2*x-1))   # gentle S-curve: defined edges
img=x*255
lum=img.mean(2,keepdims=True); img=img+np.clip(70-lum,0,None)*0.6
im=Image.fromarray(img.clip(0,255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(1.4,70,2))
im.save('lake-sharp.png'); print(im.size)

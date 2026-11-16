import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from prep import white_boxes
Image.MAX_IMAGE_PIXELS=None

def fill(src, dst):
    A=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    boxes=white_boxes(A.astype(np.uint8))
    gy0,gy1,gx0,gx1=boxes[-2]; y0,y1,x0,x1=boxes[-1]
    H,W,_=A.shape
    grade=np.zeros((H,W),bool); grade[gy0-3:gy1+3, gx0-3:gx1+3]=True
    hole=np.zeros((H,W),bool); hole[y0-24:y1+24, x0-24:x1+24]=True; hole&=~grade
    R=36
    outer=ndi.binary_dilation(hole,iterations=R)&~hole&~grade
    pattern=A.max(2)<170
    ringm=outer&pattern
    ys,xs=np.where(hole|outer); by0,by1,bx0,bx1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    T=A[by0:by1,bx0:bx1]; RM=ringm[by0:by1,bx0:bx1]; HM=hole[by0:by1,bx0:bx1]
    s=4
    a=A[::s,::s]; t=T[::s,::s]; rm=RM[::s,::s]; hm=HM[::s,::s]
    bh,bw=t.shape[:2]; best=(1e18,None)
    white=a.min(2)>190
    for cy in range(0,a.shape[0]-bh,2):
        for cx in range(0,a.shape[1]-bw,2):
            if abs(cy*s-by0)<(by1-by0) and abs(cx*s-bx0)<(bx1-bx0): continue
            if white[cy:cy+bh,cx:cx+bw][hm].any(): continue
            c=a[cy:cy+bh,cx:cx+bw]
            d=((c-t)**2)[rm].mean()
            if d<best[0]: best=(d,(cy*s,cx*s))
    cy,cx=best[1]; bb=(1e18,None)
    for dy in range(-6,7):
        for dx in range(-6,7):
            C=A[cy+dy:cy+dy+T.shape[0],cx+dx:cx+dx+T.shape[1]]
            if C.shape!=T.shape: continue
            d=((C-T)**2)[RM].mean()
            if d<bb[0]: bb=(d,(cy+dy,cx+dx))
    cy,cx=bb[1]; C=A[cy:cy+T.shape[0],cx:cx+T.shape[1]].copy()
    gain=(T[RM].mean(0)+1)/(C[RM].mean(0)+1); C*=gain
    # weight: 1 inside the hole, feathered across the outer ring, 0 elsewhere (grade box untouched)
    dist=ndi.distance_transform_edt(~HM)
    w=np.clip(1-dist/R,0,1); w[~(HM|outer[by0:by1,bx0:bx1])]=0
    out=A.copy(); out[by0:by1,bx0:bx1]=T*(1-w[...,None])+C*w[...,None]
    Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(dst)
    print(src,'source',(cx,cy),'err',round(bb[0],1),'gain',gain.round(3))

for k in ['black','lake']:
    fill(f'{k}_back_raw.png', f'{k}_back.png')
    Image.open(f'{k}_back.png').crop((1100,2400,2500,3309)).resize((700,455)).save(f'{k}_bc.png')

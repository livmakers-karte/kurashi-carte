# -*- coding: utf-8 -*-
"""
住まいのダニ・カルテ /dani/ — OGP画像(1200x630 PNG)ジェネレータ
- 外部画像・フォント配信に依存せず、Windows同梱フォント＋Pillowで“可愛い予報票”を描画。
- 生成物: dani/assets/ogp.png（相対パス参照・ローカル同梱＝セキュリティ基準/著作権クリーン）
- 再生成: python dani/assets/make_ogp.py
デザイントークン: 藍夜#29396A / 朝空#5E8CCB / 麻#FCF8F1 / アンバー#EEA23C / ローズ#C7677A
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INDIGO=(41,57,106); INDIGO2=(32,48,92); SKY=(94,140,203); LINEN=(252,248,241)
AMBER=(238,162,60); AMBER_D=(217,138,38); ROSE=(199,103,122); CREAM=(252,235,203)
INK=(42,46,58); MUTED=(110,113,128)

HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(HERE,"ogp.png")
FONTS="C:/Windows/Fonts/"

def font(name, size, index=0):
    for cand in name:
        p=os.path.join(FONTS,cand)
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size, index=index)
            except Exception: continue
    return ImageFont.load_default()

f_eye  = font(["BIZ-UDGothicB.ttc","YuGothB.ttc","meiryob.ttc"], 27)
f_big  = font(["BIZ-UDGothicB.ttc","YuGothB.ttc","meiryob.ttc"], 78)
f_sub  = font(["YuGothM.ttc","meiryo.ttc","BIZ-UDGothicR.ttc"], 26)
f_brand= font(["YuGothB.ttc","BIZ-UDGothicB.ttc","meiryob.ttc"], 22)
f_card = font(["BIZ-UDGothicB.ttc","YuGothB.ttc"], 22)
f_band = font(["BIZ-UDGothicB.ttc","YuGothB.ttc"], 30)
f_small= font(["YuGothM.ttc","meiryo.ttc"], 20)
f_num  = font(["bahnschrift.ttf","YuGothB.ttc"], 128)
f_unit = font(["YuGothM.ttc","meiryo.ttc"], 30)

img=Image.new("RGB",(W,H),INDIGO)
d=ImageDraw.Draw(img)

# 背景：斜めグラデ + ドット
for y in range(H):
    t=y/H
    c=tuple(int(INDIGO[i]+(INDIGO2[i]-INDIGO[i])*t) for i in range(3))
    d.line([(0,y),(W,y)],fill=c)
for yy in range(0,H,34):
    for xx in range(0,W,34):
        d.ellipse([xx,yy,xx+2,yy+2],fill=(255,255,255,0) if False else (60,78,130))
# 右上の朝日グロー
glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gd.ellipse([W-360,-200,W+120,280],fill=(238,162,60,60))
img=Image.alpha_composite(img.convert("RGBA"),glow).convert("RGB"); d=ImageDraw.Draw(img)

# ===== 左：コピー =====
x=64
d.text((x,92),"住まいのダニ・アレルギー診断",font=f_eye,fill=CREAM)
d.text((x-2,150),"わが家のダニ、",font=f_big,fill=(255,255,255))
d.text((x-2,238),"いま",font=f_big,fill=(255,255,255))
w_ima=d.textlength("いま",font=f_big)
d.text((x-2+w_ima,238),"何点？",font=f_big,fill=(255,206,135))
d.text((x,352),"わが家のダニリスク指数を、天気予報のように。",font=f_sub,fill=(223,230,244))
# 部屋タグ
tags=["寝室","寝具","リビング","クローゼット","車"]
tx=x
for tg in tags:
    tw=d.textlength(tg,font=f_small)
    d.rounded_rectangle([tx,410,tx+tw+28,448],radius=19,outline=(238,162,60),width=2)
    d.text((tx+14,417),tg,font=f_small,fill=CREAM)
    tx+=tw+28+12
# brand
d.text((x,552),"暮らしのカルテ",font=f_brand,fill=(255,255,255))
d.text((x+ d.textlength("暮らしのカルテ",font=f_brand)+16,556),"kurashi-carte.jp/dani",font=f_small,fill=(159,176,214))

# ===== 右：ダニ予報カード =====
cx0,cy0,cx1,cy1=690,96,1148,540
d.rounded_rectangle([cx0,cy0,cx1,cy1],radius=28,fill=(255,255,255))
d.rounded_rectangle([cx0,cy0,cx1,cy0+58],radius=28,fill=INDIGO)
d.rectangle([cx0,cy0+30,cx1,cy0+58],fill=INDIGO)
d.text((cx0+26,cy0+16),"ダニ予報カード",font=f_card,fill=(255,255,255))
d.text((cx1-118,cy0+22),"HOME CARTE",font=f_small,fill=(185,198,226))

# マスコット（おひさま布団・sunny）
mcx,mcy,mr=cx0+96,cy0+150,58
# 光条
for ang,dx,dy in [(0,0,-1),(1,0.8,-0.8),(2,1,0),(3,0.8,0.8),(4,-0.8,-0.8),(5,-1,0),(6,-0.8,0.8)]:
    d.line([(mcx+dx*(mr+8),mcy+dy*(mr+8)),(mcx+dx*(mr+22),mcy+dy*(mr+22))],fill=AMBER,width=6)
d.rounded_rectangle([mcx-mr,mcy-mr+8,mcx+mr,mcy+mr-2],radius=26,fill=CREAM,outline=AMBER,width=5)
d.arc([mcx-mr,mcy-6,mcx+mr,mcy+mr+30],200,340,fill=AMBER,width=3)
d.ellipse([mcx-26,mcy-6,mcx-14,mcy+6],fill=INDIGO)   # 目
d.ellipse([mcx+14,mcy-6,mcx+26,mcy+6],fill=INDIGO)
d.ellipse([mcx-40,mcy+8,mcx-24,mcy+24],fill=(245,183,166))  # 頬
d.ellipse([mcx+24,mcy+8,mcx+40,mcy+24],fill=(245,183,166))
d.arc([mcx-16,mcy+8,mcx+16,mcy+34],200,340,fill=INDIGO,width=4)  # 口

# 指数
d.text((cx0+186,cy0+96),"わが家のダニリスク指数",font=f_small,fill=MUTED)
d.text((cx0+182,cy0+120),"62",font=f_num,fill=INDIGO)
nw=d.textlength("62",font=f_num)
d.text((cx0+182+nw+8,cy0+196),"点",font=f_unit,fill=MUTED)
# バンドチップ
d.rounded_rectangle([cx0+300,cy0+128,cx0+404,cy0+172],radius=14,fill=AMBER)
d.text((cx0+322,cy0+134),"多め",font=f_band,fill=(58,42,8))

# ゲージ
gx0,gx1,gy=cx0+40,cx1-40,cy0+280
segs=[SKY,(124,160,192),AMBER,(222,138,90),ROSE]
seglen=(gx1-gx0)/len(segs)
for i,c in enumerate(segs):
    d.rounded_rectangle([gx0+i*seglen,gy,gx0+(i+1)*seglen,gy+18],radius=9 if i in(0,len(segs)-1) else 0,fill=c)
# 針
nx=gx0+(gx1-gx0)*0.62
d.rounded_rectangle([nx-4,gy-8,nx+4,gy+26],radius=3,fill=INDIGO)
d.ellipse([nx-8,gy-8,nx+8,gy+8],fill=INDIGO,outline=(255,255,255),width=3)
d.text((gx0,gy+30),"ひかえめ",font=f_small,fill=MUTED)
d.text((gx1-d.textlength("繁殖ピーク",font=f_small),gy+30),"繁殖ピーク",font=f_small,fill=ROSE)

# 部屋別処方の一言
d.rounded_rectangle([cx0+40,cy0+352,cx1-40,cy0+412],radius=14,fill=(252,248,241),outline=(230,222,206),width=2)
d.ellipse([cx0+58,cy0+374,cx0+74,cy0+390],fill=AMBER)
d.text((cx0+86,cy0+370),"部屋別に、必要枚数を処方します。",font=f_small,fill=INK)

img.save(OUT,"PNG")
print("OGP written:",OUT, os.path.getsize(OUT),"bytes")

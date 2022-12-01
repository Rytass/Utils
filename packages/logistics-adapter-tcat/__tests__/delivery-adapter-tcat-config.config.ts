export const TraceCases = {
  901230160565: `
  <html lang="zh-Hant">
  
  <head>
    <!-- viewport -->
    <meta name="viewport"
      content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no" />
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="shortcut icon" href="/images/favicon.ico" />
    <title>
      黑貓宅急便 - 一般貨物追蹤查詢
    </title>
  
    <!-- icon fonts -->
    <link rel="stylesheet" href="/fonts/style.css" />
  
    <!-- jQuery -->
    <script src="/js/jquery-3.5.1.min.js"></script>
    <script src="/js/jquery-migrate-3.3.0.min.js"></script>
  
    <!-- js pluging -->
    <script src="/js/lib/checkDevice.js"></script> <!-- RWD JS checkDevice -->
    <script src="/js/lib/enquire/enquire.min.js"></script> <!-- RWD JS window size -->
    <link rel="stylesheet" href="/js/lib/slick/slick.css" />
    <script src="/js/lib/slick/slick.min.js"></script>
    <script src="/js/lib/gsap/gsap.min.js"></script>
  
    <!-- custom css -->
    <link rel="stylesheet" href="/css/style.css" />
  
    <!-- custom js -->
    <script src="/js/script.js"></script>
  
    <!-- 解決IE7~8看不懂html5的標籤 -->
    <!--[if lt IE 9]>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js">
      </script>
      <![endif]-->
  
  
  
    <script>
      //force SSL
              url = location.href;
              if (url.toLowerCase().indexOf("http://") == 0) {
                  location = "https://" + url.substr(7);
              }
  
  
              function GSearch() {
                  //alert($("#keyword").val());
                  //return;
                  if ($("#keyword").val() == "") {
                      alert("請您先輸入關鍵字");
                      return false;
                  }
                  //alert('location');
                  
                  location = '/result.aspx?q=' + encodeURIComponent($("#keyword").val());
                  return false;
              }
    </script>
  
  
    <link href="../css.css" type="text/css" rel="stylesheet" />
  </head>
  
  <body id="pagebody" class="inpage">
    <!-- header -->
    <header>
      <div class="header-wrap">
        <!-- logo -->
        <h3><a href="/default.aspx"><img src="/images/logo.svg" alt=""></a></h3>
        <!-- header nav -->
        <ul class="header-nav">
          <li>
            <span class="header-nav_trigger">寄件</span>
            <div class="megamenu-wrap">
              <ul class="megamenu-inner">
                <li>
                  <div class="megamenu-list_title">服務介紹</div>
                  <ul class="megamenu-list">
                    <li><a href="/product/normal.aspx">常溫宅急便</a></li>
                    <li><a href="/product/cool.aspx">低溫宅急便</a></li>
                    <li><a href="/product/economy.aspx">經濟宅急便</a></li>
                    <li><a href="/product/day.aspx">當日宅急便</a></li>
                    <li><a href="/product/freight.aspx">到付宅急便</a></li>
                    <li><a href="/product/golf.aspx">高爾夫宅急便</a></li>
                    <li><a href="/product/medicine.aspx">醫藥物流服務</a></li>
                    <li><a href="/product/cvs.aspx">宅轉店服務</a></li>
                    <li><a href="/product/rapid.aspx">快速到店</a></li>
                    <li><a href="/product/store.aspx">倉儲服務</a></li>
                    <li><a href="/product/twoec.aspx">黑貓探險隊</a></li>
                    <li><a href="https://www.ccat.com.tw/Home/Index" target="_blank">金流代收服務</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">icat網路宅急便</div>
                  <ul class="megamenu-list">
                    <li><a href="/consign/info.aspx">服務說明</a></li>
                    <li><a href="/consign/sheet/sheetAdd.aspx">單筆預約寄件</a></li>
                    <!-- <li><a href="/consign/sheet/smultiple.aspx">多筆預約寄件</a></li> -->
                    <li><a href="/consign/icatapp.aspx">icat app</a></li>
                    <li><a href="/order/OrderHistory.aspx?OrderType=icat">訂單管理</a></li>
                    <li><a href="/consign/notice.aspx">配完通知&查詢</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">寄件指南</div>
                  <ul class="megamenu-list">
                    <li><a href="/send/remind.aspx">包裝建議</a></li>
                    <!-- <li><a href="">託運單填寫方式</a></li> -->
                    <li><a href="/send/clause.aspx">託運條款</a></li>
                    <li><a href="/send/reject.aspx">不受理項目</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">包裝資材</div>
                  <ul class="megamenu-list">
                    <!-- <li><a href="/product/info.aspx">包裝資材介紹</a></li> -->
                    <li><a href="/product/productList.aspx">包裝資材訂購</a></li>
                    <li><a href="/order/orderHistory.aspx?OrderType=Life">訂單管理</a></li>
                  </ul>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <span class="header-nav_trigger">查詢</span>
            <div class="megamenu-wrap">
              <ul class="megamenu-inner">
                <li>
                  <div class="megamenu-list_title">包裹查詢</div>
                  <ul class="megamenu-list">
                    <li><a href="/inquire/explain.aspx">包裹查詢說明</a></li>
                    <li><a href="/inquire/trace.aspx">一般包裹查詢</a></li>
                    <li><a href="/inquire/traceContinus.aspx">連號包裹查詢</a></li>
                    <li><a href="/inquire/international.aspx">國際包裹查詢</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">運送及送達時間查詢</div>
                  <ul class="megamenu-list">
                    <li><a href="/inquire/timesheet1.aspx">送達時間說明</a></li>
                    <li><a href="/inquire/timesheet3.aspx">運費說明</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">服務據點查詢</div>
                  <ul class="megamenu-list">
                    <li><a href="/inquire/foothold.aspx">黑貓寄取站查詢</a></li>
                    <li><a href="/inquire/substore.aspx">合作代收查詢</a></li>
                    <!--
                                          <li><a href="/inquire/Golf.aspx">合作代收高爾夫球場查詢</a></li>
                      <li><a href="/inquire/Hotel.aspx">合作代收飯店查詢</a></li>
                                          -->
                  </ul>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <span class="header-nav_trigger">客戶服務</span>
            <div class="megamenu-wrap">
              <ul class="megamenu-inner">
                <li>
                  <div class="megamenu-list_title">常見問題</div>
                  <ul class="megamenu-list">
                    <li><a href="/services/qa.aspx">常見問題</a></li>
                    <li><a href="/services/chtotw.aspx">跨境包裹消費爭議專區</a></li>
                    <li><a href="/contract/ezcat.aspx">ezcat下載</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title">聯絡黑貓</div>
                  <ul class="megamenu-list">
                    <li><a href="/services/webcontact.aspx">網路客服</a></li>
                    <li><a href="https://neko.t-cat.com.tw/webchat/index.html" target="_blank">智能客服</a>
                    </li>
                    <li><a href="/services/step.aspx">自助寄件專線</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="http://103.234.81.14/invoice_query.aspx"
                      target="_blank">電子發票</a></div>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <span class="header-nav_trigger">個人會員</span>
            <div class="megamenu-wrap">
              <ul class="megamenu-inner">
                <li>
                  <div class="megamenu-list_title">icat網路宅急便</div>
                  <ul class="megamenu-list">
                    <li><a href="/consign/info.aspx">服務說明</a></li>
                    <li><a href="/consign/sheet/sheetAdd.aspx">
                        <!--單筆-->預約寄件</a></li>
                    <!-- <li><a href="/consign/sheet/smultiple.aspx">多筆預約寄件</a></li> -->
                    <li><a href="/consign/icatapp.aspx">icat app</a></li>
                    <li><a href="/member/join.aspx">加入會員</a></li>
                    <li><a href="/member/member_terms.aspx">會員條款</a></li>
                    <li><a id="lnkLogin" href="/member/login.aspx">會員登入</a></li>
                    <li><a href="/member/join.aspx?Edit=True">會員資料維護</a></li>
                    <li><a href="/member/recipientlist.aspx">常用聯絡人</a></li>
                    <li><a href="/order/orderhistory.aspx">訂單管理</a></li>
                    <li><a href="/consign/notice.aspx">配完通知&查詢</a></li>
                  </ul>
                </li>
  
                <li>
                  <div class="megamenu-list_title">LINE</div>
                  <ul class="megamenu-list">
                    <li><a href="/line/lineinfo.aspx">服務說明</a></li>
                    <li><a href="https://lin.ee/tfmFj0q" target="_blank">加入好友</a></li>
                  </ul>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="/member/privacy.aspx">隱私權聲明</a></div>
                </li>
              </ul>
            </div>
          </li>
          <li>
            <span class="header-nav_trigger">契約客戶專區</span>
            <div class="megamenu-wrap">
              <ul class="megamenu-inner">
                <li>
                  <div class="megamenu-list_title"><a href="/contract/business.aspx">契約客戶專區</a></div>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="/contract/join.aspx">契約客戶洽談</a></div>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="/contract/status.aspx">包裹狀態查詢介紹</a></div>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="/contract/ezcat.aspx">ezcat印單軟體下載</a></div>
                </li>
                <li>
                  <div class="megamenu-list_title"><a href="/contract/scat.aspx">SmartCat app 智能宅急便</a>
                  </div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
        <!-- header search -->
        <div class="header-search">
          <!--<input type="text" placeholder="站內搜尋">-->
          <input name="q" id="keyword" type="text" placeholder="站內搜尋" onkeydown ="if (event.keyCode == 13) GSearch();" />
          <button onclick="javascript:GSearch();"></button>
        </div>
        <!-- mobile hamburg -->
        <div class="hamburg-box"><span></span></div>
      </div>
    </header>
  
  
  
  
    <div>
  
  
  
      <!-- inpage-wrap -->
      <section class="inpage-wrap">
        <!-- 麵包削 -->
        <div class="breadcrumb-box">
          <ul class="breadcrumb-list">
            <li><a href="/default.aspx">首頁</a></li>
            <li><a href="">查詢</a></li>
            <li><a href="">包裹查詢</a></li>
            <li>一般包裹查詢</li>
          </ul>
        </div>
  
        <!-- 一般包裹查詢 -->
        <div class="full-wrap">
          <div class="full-inner inquire">
  
            <!-- 查詢結果2 -->
  
  
  
  
  
            <table cellpadding="2" border="1" id="resultTable" cellspacing="0" class="tablelist"
              style="display:none;">
              <tr class="top">
                <td>國際宅急便包裹查詢號碼</td>
                <td height="38">貨態</td>
                <td>資料登入時間</td>
                <td>負責營業所 </td>
              </tr>
              <tr valign='center' align='middle' bgcolor='#ffffff'><td height='44' rowspan='4'> <span class='bl12'>901230160565 </span></td>
              <td class='style1' bgcolor='yellow' title='包裹已經送達收件人'><span class='r2'><strong>順利送達</strong></span> </td><td class='style1' bgcolor='yellow'><div align='center'><span class='bl12'>2022/12/01 <br>16:14</div>    </td>    <td class='style1' bgcolor='yellow'>        <span class='bl12'><a class='text4' href='foothold.aspx?n=伊通營業所'>伊通營業所</a></span></td></tr><tr valign='center' align='middle' bgcolor='#cef4f5'>  <td class='style1' title='sd正在將包裹配送到收件人途中'> <span class='bl12'>配送中</span> </td>  <td class='style1'>    <div align='center'>      <span class='bl12'>2022/12/01 <br>16:14</div>    </td>    <td class='style1' >        <span class='bl12'><a class='text4' href='foothold.aspx?n=伊通營業所'>伊通營業所</a></span>  </td></tr><tr valign='center' align='middle' bgcolor='#ffffff'>  <td class='style1' title='sd正在將包裹配送到收件人途中'> <span class='bl12'>配送中</span> </td>  <td class='style1'>    <div align='center'>      <span class='bl12'>2022/12/01 <br>07:11</div>    </td>    <td class='style1' >        <span class='bl12'><a class='text4' href='foothold.aspx?n=伊通營業所'>伊通營業所</a></span>  </td></tr><tr valign='center' align='middle' bgcolor='#cef4f5'>  <td class='style1' title='sd已經至寄件人指定地點收到包裹'> <span class='bl12'>已集貨</span> </td>  <td class='style1'>    <div align='center'>      <span class='bl12'>2022/11/30 <br>19:54</div>    </td>    <td class='style1' >        <span class='bl12'><a class='text4' href='foothold.aspx?n=北三特販一所'>北三特販一所</a></span>  </td></tr>
            </table>
  
  
            <!-- 查詢結果3 -->
            <div id="ContentPlaceHolder1_tblResultOuter" class="inquire-box">
              <div class="tit textaligncenter">一般包裹查詢</div>
              <p class='textaligncenter'>您所輸入的包裹查詢號碼以及查詢結果如下:</p>
              <!-- order list -->
              <div class="orderlist-box hastable" id="divResult">
  
                <!-- template -->
                <div class="orderlist-table" id="template" style="display:none;">
                  <div class="table-header">包裹查詢號碼 <span>429992512352</span></div>
                  <table>
                    <tr>
                      <td><span class="table-thead">資料登入時間</span></td>
                      <td></td>
                      <td><span class="table-thead">目前狀態</span></td>
                      <td><span class="table-thead">負責營業所</span></td>
                    </tr>
                    <tr>
                      <td>2021/06/18 <span class="time">08:03</span></td>
                      <td>
                        <div class="step-disc">
                          <div class="disc"></div>
                          <div class="line"></div>
                        </div>
                      </td>
                      <td>未順利取件，請洽客服中心</td>
                      <td><a href="">嘉義營業所</a></td>
                    </tr>
  
                  </table>
                </div>
              </div>
              <!-- info list -->
              <ul class="list-number sizem">
                <p>包裹狀態說明</p>
                <li>若對於包裹狀態說明不清楚，可參閱<a href="">貨態定義一覽表</a>。</li>
                <li>
                  若資料庫尚未能查詢到該筆包裹查詢號碼狀態，可能原因如下：
                  <ul class="list-disc">
                    <li>資料尚在處理中。</li>
                    <li>該筆包裹查詢號碼查無狀態。</li>
                  </ul>
                </li>
              </ul>
              <div class="btn-box">
                <a href="trace.aspx" class="btn">重新查詢</a>
  
              </div>
  
  
              <script>
                $(document).ready(function () {
                              //產生貨態表
                              var tmp;
                              var s;
                              $("#resultTable tr").each(function (index) {
                                if (index > 0) {
                                    //alert($(this).children().length);
                                    //$("#divResult").append("<p>" + index + "</p>");
                                    if ($(this).children().length == 4) {
                                        $("#divResult").append(tmp);
  
                                        s = 0;
                                        tmp = $('#template').clone();
                                        //head
                                        tmp.find("span")[0].innerHTML = $(this).children()[0].innerHTML;
                                        tmp.css("display", "");
  
                                    };
                                    s += 1;
                                    tmp1 = $('#template').find("tr:nth-child(2)").clone();
                                    if (s == 1) {
                                        tmp1.addClass("active");
                                        tmp.find("table").find("tr:nth-child(2)").remove();
                                        tmp1.find("td")[0].innerHTML = $(this).children()[2].innerHTML.replace("<br>","");
                                        tmp1.find("td")[2].innerHTML = $(this).children()[1].innerHTML;
                                        tmp1.find("td")[3].innerHTML = $(this).children()[3].innerHTML;
                                    } else {
                                        tmp1.find("td")[0].innerHTML = $(this).children()[1].innerHTML.replace("<br>", "");
                                        tmp1.find("td")[2].innerHTML = $(this).children()[0].innerHTML;
                                        tmp1.find("td")[3].innerHTML = $(this).children()[2].innerHTML;
                                    }
                                    tmp.find("table").append(tmp1);
                                }
  
                            });
                            $("#divResult").prepend(tmp);
  
                        })
              </script>
  
            </div>
          </div>
        </div>
      </section>
  
  
  
  
  
  
    </div>
  
  
  
    <!-- footer -->
    <footer>
      <div class="footer-bg"></div>
      <div class="footer-box1">
        <ul class="footer-nav">
          <li>
            <div class="footer-nav_title">企業情報</div>
            <ul class="nav-list">
              <li><a href="/company/about.aspx">認識黑貓</a></li>
              <li><a href="/company/events.aspx">品牌展望</a></li>
              <li><a href="/company/news.aspx">最新消息</a></li>
              <li><a href="/company/article.aspx">黑貓NEWS</a></li>
              <li><a href="/humanresource/job1.htm">黑貓徵才</a></li>
              <li><a href="/communication.aspx">利害人關係專區</a></li>
            </ul>
          </li>
          <li>
            <div class="footer-nav_title">客戶服務</div>
            <ul class="nav-list">
              <li><a href="/services/qa.aspx">常見問題</a></li>
              <li><a href="/services/webcontact.aspx">聯絡黑貓</a></li>
              <li><a href="http://103.234.81.14/invoice_query.aspx" target="_blank">電子發票</a></li>
            </ul>
          </li>
          <li>
            <ul class="nav-list">
              <div class="footer-nav_title">個人會員</div>
              <li><a href="/member/login.aspx">會員登入</a></li>
              <li><a href="/member/join.aspx">會員註冊</a></li>
            </ul>
          </li>
          <li>
            <div class="footer-nav_title">社群平台</div>
            <ul class="nav-list sn">
              <li class='fb'><a href="https://www.facebook.com/takkyubin" target="_blank">Facebook</a></li>
              <li class='yt'><a href="https://www.youtube.com/user/MrCat4128888" target="_blank">YouTube</a>
              </li>
              <li class='line'><a href="https://lin.ee/tfmFj0q" target="_blank">LINE</a></li>
            </ul>
          </li>
        </ul>
      </div>
      <div class="footer-box2">
        <div class="footer-copyright">
          <div class="col-1">統一速達股份有限公司 版權所有 <span>COPYRIGHT © 2022 PRESIDENT TRANSNET CORP.</span></div>
          <div class="col-2">統一編號 : 70762591 <span>公司地址：台北市南港區重陽路200號4樓</span></div>
        </div>
        <ul class="footer-link">
          <li><a href="/sitemap.aspx">網站地圖</a></li>
          <li><a href="/member/privacy.aspx">隱私權聲明</a></li>
          <li><a href="/send/clause.aspx">託運條款</a></li>
          <li><a href="/jp">日文網站</a></li>
        </ul>
      </div>
    </footer>
  
    <div id="pnlGoogleAnalytics">
  
      <!--googlelcode-->
      <script type="text/javascript">
        var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");
  
      document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));
  
      </script>
  
      <script type="text/javascript">
        if (_gat != undefined) {
          //var pageTracker = _gat._getTracker("UA-4888179-1");
          var pageTracker = _gat._getTracker("UA-206063462-1");
          pageTracker._trackPageview();
      }
      </script>
  
  
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-9FD03RW0RH"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
  
    gtag('config', 'G-9FD03RW0RH');
      </script>
  
  
    </div>
  
  
  
  
    <!-- 智能客服  -->
  
    <script type="text/javascript">
      var tag_hdr = document.getElementsByTagName("head")[0];
           var tag_script = document.createElement("script");
           var r = new Date().getDate();
  
           tag_script.setAttribute("id", "WebChatEntryPlugIn");
           tag_script.setAttribute("type", "text/javascript");
           //tag_script.setAttribute("src", "https://neko.t-cat.com.tw/webchat_test/WebChatEntryRWD.js?r=" + r);
           tag_script.setAttribute("src", "https://neko.t-cat.com.tw/webchat/WebChatEntryRWD.js?r=" + r);
           tag_hdr.appendChild(tag_script);
    </script>
  </body>
  
  </html>`,

  notExisted: `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>
黑貓宅急便
</title><meta name="description"><link href="../css/common.css?r=0514" rel="stylesheet" type="text/css"><link href="../css/animate.css" rel="stylesheet" type="text/css">
  <!--<script type="text/javascript" src="/js/jquery.js"></script>-->
  <script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>
  <script src="https://code.jquery.com/jquery-migrate-3.3.2.min.js" integrity="sha256-Ap4KLoCf1rXb52q+i3p0k2vjBsmownyBTE1EqlRiMwA=" crossorigin="anonymous"></script>

  <style type="text/css">html, body { height:100%; }								 #EcpWebChatEntryPane{                                      	position: fixed;                                         	bottom: 0px;                                             	right: 0px;                                              	width: 0px;                                              	height: 600px;                                           	padding: 0px;                                            	font-size: 16px;                                         	cursor: default;                                         	box-sizing: border-box;                                  	resize: both;                                            	border: 0px solid rgb(64, 64, 128);                      	z-index: 99999;                                          	display: block;                                          }                                                          #EcpWebChatEntryButton{                                    	position: fixed;                                         	bottom: 30%;                                             	right: 0px;                                              	width: 180px; 																					 	height: 180px;                                           	cursor:pointer;                                          	text-align:center;                                       	line-height:30px;                                        	font-family:"Microsoft JhengHei",sans-serif;			 	font-weight: bolder;			 	color:#006f73;                                              	z-index: 99998;                                          	overflow: hidden;                                        }    			                                             #EcpWebChatEntryButton .EcpWebChat_text{                   	font-weight: bolder;			 	padding-top:115px;                                       	font-size:13px;                                          }    			                                             #EcpWebChatEntryButton:hover{color: color: #006f73}    	 		 #EcpWebChatEntryButton.EcpWebChat_min{                     	width:   180px; 																						height: 180px;                                           	padding:  0px;                                           	color:#006f73;          									 	font-family:"Microsoft JhengHei",sans-serif;			 	font-weight: bold;			 }    			                                             #EcpWebChatEntryButton.EcpWebChat_min:hover .EcpWebChat_arrow{                   	margin: 8px 0 0 17px;                                	 	width:40px;												 	height: 30px;                                            }  														 #EcpWebChatEntryButton.EcpWebChat_min .EcpWebChat_text{    	padding-top:20px;                          				 	width:22px;                          					 	text-shadow: black 0.1em 0.1em 0.2em;                          					 	font-size:1.5em;                                         	line-height:25px; 										 	margin:0 8px;          								 	 }    			                                             #EcpWebChatEntryButton.EcpWebChat_min:hover{color: #ffffff;}    		 #EcpWebChatEntryButton.EcpWebChat_min:active{color:#006f73;}    	 #EcpWebChatPostFrameForm{                                  	display:none;                                            }                                                          #EcpWebChatIFrame{                                         	height:600px;                                            	width:477px;                                             	right:0                                                  	border-radius: 10px;                                     	-webkit-box-shadow: rgba(0, 0, 0, 0.15) -8px 10px 15px 0;	-moz-box-shadow: rgba(0, 0, 0, 0.15) -8px 10px 15px 0;   	box-shadow: rgba(0, 0, 0, 0.15) -8px 10px 15px 0;        }                                                          #EcpWebChatEntryLeft{                                      	width:0px;                                               	float:left;                                              	margin-top:10px;                                         }                                                          #EcpWebChatEntryRight{                                     	width:0px;                                               	float:right;                                             }                                                          #EcpWebChatEntryClean{clear:both;}                         #EcpWebChatCloseButton{                                    	background-repeat: no-repeat;                            	width:32px;                                              	height:100px;                                            	cursor:pointer;                                          	font-family:"Microsoft JhengHei",sans-serif;			 	color:#000;			 									 	padding-top:10px;			 						     }                                                          #EcpWebChatCloseButton .EcpWebChat_text{                   	padding-top:15px;                          				 	width:20px;                          					 	font-size:1.1em;                                         	line-height:25px; 										 	margin:0 5px;          								 	 }   														 #EcpWebChatCloseButton .EcpWebChat_text:hover{             	color: #ff0000;                                          }                                                          #EcpWebChatCloseButton .EcpWebChat_arrow{                  	margin-left:11px;                                	     	width:40px;												 }  														 #EcpWebChatLoad{                                           	z-index:99997;                                	         	position: fixed;										 	text-align:center;										 	padding-top:150px;				                         	background-color:#F8F6F1;				                 	border-radius: 10px 0 10px 0;width:477px;                	width:477px;                                             }  														 #EcpWebChatCloseButton{background: url(https://neko.t-cat.com.tw/webchat/image/close_btn_l.png) no-repeat 0 center;}						#EcpWebChatEntryButton{background: url(https://neko.t-cat.com.tw/webchat/image/Qbi_TradeMark_a.gif) no-repeat 0 center;background-size: contain;}						#EcpWebChatEntryButton.EcpWebChat_min{background: url(https://neko.t-cat.com.tw/webchat/image/Qbi_TradeMark_a.gif) no-repeat 0 center;background-size: contain;}				#EcpWebChatCloseButton:hover .EcpWebChat_arrow{background: url(https://neko.t-cat.com.tw/webchat/image/arrow_btn.png) no-repeat 0 center;}	</style></head><body><xscript type="text/javascript" src="/js/jquery-migrate.js"></xscript>
  <script type="text/javascript">
      $(function () {
          /*$("#lNavTg").next("ul").hide();
          $("#lNavTg").children("p").removeClass("icoClose").addClass("icoOpen");
          $("#lNavTg").next("ul").children("li").each(function(){
          var href=document.location.protocol + '//'+ document.location.hostname+ document.location.pathname;
          if($(this).children("a").get(0).href == href){
          $(this).parent().show();
          $(this).parent().prev().children("p").removeClass("icoOpen").addClass("icoClose");
          $(this).children("a").css("background-color","#FDE998").css("color","#003399");
          return false;
          }
          });*/

          //個人會員登入
          $('.individual').click(function () {
              if($(this).children("a").attr("logout") != "true"){
                  $('.pupLogin').addClass('animated bounceInDown').slideToggle();
              }
          });

          //展開選單
          $('.lNavTg').click(function () {
              if ($(this).children("p").attr("class") == "icoClose") {
                  $(this).children("p").removeClass("icoClose").addClass("icoOpen");
              } else {
                  $(this).children("p.icoOpen").removeClass("icoOpen").addClass("icoClose");
              }
              $(this).next("ul").slideToggle();
          });

          var tabClickEvent = function () {
              if ($(this).attr("class") != "tabCurrent") {

                  var cookiefont = getCookieFont();
                  if (cookiefont == null) cookiefont = 2;

                  heightFlag = true;
                  changeFont(cookiefont);

                  myStr = $(this).attr("id");

                  if (myStr != "") {
                      var nextTab = '#' + myStr + 'Body';
                      var curentStr = $(this).parent().children("li.tabCurrent").attr("id");
                      var currentTab = '#' + curentStr + 'Body';

                      $(currentTab).parent().css("height", $(currentTab).height())

                      $(currentTab).hide();
                      $(nextTab).fadeIn("normal", function () {
                          $(currentTab).parent().css("height", "auto");
                      });
                      //location.href = "#"+myStr;

                      $(this).parent().children("li.tabCurrent").css("background-position", "top left");
                      $(this).parent().children("li.tabCurrent").css("color", "#333");
                      $(this).parent().children("li.tabCurrent").removeClass("tabCurrent");
                      $(this).addClass("tabCurrent");
                  }
                  else {
                      location.href = url;
                  }
              }
          }


          //contentsArea 左右欄位等高
          /*
          var maxHeight = 0;
          $('.contentsArea .contentsInner').each(function () {
              maxHeight = Math.max(maxHeight, $(this).height());
          }).height(maxHeight);
          */
      });

      //2018-4-23 forece SSL
      var u = window.location.toString().toLowerCase();
      //alert(u);
      if (u.indexOf("http://") == 0 && ( u.indexOf(".t-cat.com.tw") > 0 ||  u.indexOf("61.57.227.173") > 0 )) {
          window.location = "https://" + u.substring(7);
      }
  </script>
  
<link href="../css.css" type="text/css" rel="stylesheet">

<form method="post" action="./TraceDetail.aspx?BillID=notExisted&amp;ReturnUrl=Trace.aspx" id="form1">
<div class="aspNetHidden">
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="aAWbJGqk5UoKAKQKsq/lXhfGtAVGDeEYV4kSa5euGrln7WicbM/kcHgTGkPdt5uPcmiZo+4zH0jFH8bn18DWrqx+6rBmH24krk2wIzESgeZQvXSHuqZNQAlHG6bbo5FyB3wMnOfTFEcho/V1e0qwAI8k+5LGUXUEqVEjyNuHaDJo+Jx+Ik4tF5KK7fzyy0eGmG+6eDW9A5fUoihm+sIlf/ayRTU=">
</div>

<div class="aspNetHidden">

<input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="A0A027F1">
</div>



<div id="wrapper">
<!----------------------------------------header----------------------------------------------->


 <div id="headerContainer">
  <div id="header">
    <div class="logo"><a href="/"><img src="../../img/logo.gif" width="300" height="40"></a></div>
    
    <div class="headerNav">
      <ul>
          <!--
        <li class="languageJp"><a href="/jp/index.aspx">日本語</a></li>
        <li class="servicePhone"><a href="/CallCenter/service.aspx">客服專線:412-8888(手機加02)</a></li>
        -->
        <li class="servicePhone02"><a href="/CallCenter/service02.aspx">自動寄件專線:412-8689(手機加02)</a></li>
        <li class="servicePhone"><a href="https://neko.t-cat.com.tw/webchat/index.html" target="_blank">智能客服</a></li>        
        <!-- <li class="languageJp"><a href="/jp/index.aspx">日本語</a></li> -->
      </ul>
    </div>
    
    <div class="headerLogin">
      <ul>
        <li class="individual"><a style="cursor:pointer;">個人會員登入</a></li>
        <li class="contract"><a href="https://www.takkyubin.com.tw/YMTContract/aspx/Login.aspx" target="_blank">契約客戶登入</a></li>
      </ul>
    </div> 
    
    <div class="pupLogin" style="z-index:99999;">

      <div style="position:relative;left:20px;top:20px;">
      <iframe width="200" height="235" src="/member/MiniLogin.aspx" scrolling="no" frameborder="0"></iframe>
      </div>
    </div>     
    
    <div id="mainNav" style="z-index:2000">
      <ul>
        <li class="service">
          <a href="/Product/index.aspx">商品服務</a>
          <ul class="subL1">
              <li>
                <a href="#">商品介紹</a>
                <ul class="subL2">
                    <li><a href="/Product/normal.aspx">常溫宅急便</a></li>
                    <li><a href="/Product/cool.aspx">低溫宅急便</a></li>
                    <li><a href="/Product/economy.aspx">經濟宅急便</a></li>
                    <li style="display:none;"><a href="/Product/airport.aspx">機場宅急便</a></li>
                    <li><a href="/Product/golf.aspx">高爾夫宅急便</a></li>
                    <li><a href="/Product/day.aspx">當日宅急便</a></li>
                    <li><a href="/Product/freight.aspx">到付宅急便</a></li> 					  
                    <!--<li><a href="/Product/abroad.aspx">國際宅急便</a></li>-->
                </ul>
              </li>          
              <li>
                <a href="#">宅配服務介紹</a>
                  <ul class="subL2">
                      <li><a href="/Product/notice.aspx">配達完通知</a></li>
                      <li><a href="/Product/preview.aspx">配送預告</a></li>
          <!-- <li><a href="/Product/italking.aspx">iTalking 影音宅急便</a></li> -->
                  </ul>
              </li>
              <li>
                <a href="#">訂購服務</a>
                  <ul class="subL2">
                      <li><a href="/Product/info.aspx">包裝資材介紹</a></li>
                      <li><a href="/Product/ProductList.aspx?CateId=2">包裝資材訂購</a></li>
<!--
                      <li><a href="/Product/life.aspx">輕‧生活用品介紹</a></li>
                      <li><a href="/Product/ProductList.aspx?CateId=3">輕‧生活用品訂購</a></li>                       
-->
                      <li><a href="/Order/OrderHistory.aspx?OrderType=icat">訂單管理/取消</a></li>                       
                  </ul>	
              </li>
              <!--20150921新增-->
              <li>
                <a href="https://www.ccat.com.tw/Home/Index">金流服務</a>                    
              </li>
              <!--/20150921新增-->
              <li>
                <a href="#">契約客戶</a>
                  <ul class="subL2">
                    <!-- <li><a href="http://www.scmcat.com.tw/" target="_blank">SCM供應鏈平台</a></li> -->
                      <li><a href="/contract/explain.aspx">印單軟體介紹</a></li>
                      <li><a href="/contract/status.aspx">包裹狀態查詢介紹</a></li>
                      <li><a href="/contract/ezcat.aspx">ezcat印單軟體下載</a></li>
                      <li><a href="/contract/scat.aspx">SmartCat APP智能宅急便</a></li>
                    <li><a href="/contract/business.aspx">契約客戶專區</a></li> 
                      <!--<li><a href="/CallCenter/WebContact.aspx?Type=2">業務洽談</a></li>-->
                      <li><a href="https://www.ccat.com.tw/Home/Index" target="_blank">宅急便客樂得</a></li>
<!--
                      <li><a href="/contract/scat.aspx">SmartCat app介紹</a></li>
                <li><a href="/scat/scat.html" target="_blank">scat app智能宅急便</a></li>
-->
                  </ul>
              </li>
<!--				
              <li>
                <a href="#">其他</a>
                  <ul class="subL2" style="top:50px;">
                      <li><a href="/Product/other.aspx">服務特徵</a></li>
                      <BR /><BR /><BR /><BR/>
                  </ul>
              </li>                
-->
          </ul>    
        </li>
        <li class="sending">
           <a href="/send/index.aspx">寄件</a>
           <ul class="subL1">
                <li>
                  <a href="/send/index.aspx">服務介紹</a>
                  <!--
                  <ul class="subL2">
                      <li><a href="/send/index.aspx#1">一般包裹</a></li>
                      <li><a href="/send/index.aspx#2">生鮮品</a></li> 
                      <li><a href="/send/index.aspx#3">小包裹.輕便</a></li>
                      <li><a href="/send/index.aspx#4">icat網路宅急便</a></li>
                      <li><a href="/send/index.aspx#5">快速</a></li>
                      <li><a href="/send/index.aspx#6">行李</a></li>
                      <li><a href="/send/index.aspx#7">維修</a></li>
                      <li><a href="/send/index.aspx#8">到付</a></li>
                      <li><a href="/send/index.aspx#9">國外</a></li>                                                           
                  </ul>
                  -->
                </li>
                <li>
                  <a href="#">icat網路宅急便</a>
                  <ul class="subL2">
                      <li><a href="/consign/info.aspx">服務介紹</a></li>
                      <li><a href="/consign/sheet/sheetAdd.aspx">預約寄件</a></li>
                  </ul>
                </li>
                <li><a href="/Order/OrderHistory.aspx?act=r&amp;OrderType=icat">訂單管理</a></li>
                <li>
                  <a href="#">寄件指南</a>
                  <ul class="subL2">
                      <li><a href="/send/remind.aspx">包裹建議</a></li>
                      <li><a href="/send/write.aspx">託運單填寫內容</a></li> 
                      <li><a href="/send/clause.aspx">託運條款</a></li>
                      <li><a href="/send/reject.aspx">不受理品項</a></li>                                                            
                  </ul>
                </li>
                <li><a href="/Product/info.aspx">包裝資材</a></li>                        
           </ul>
        </li>
        <li class="receiving"><a href="/Product/preview.aspx">收件</a>
          <ul class="subL1">
              <li><a href="/Product/preview.aspx">配送預告</a></li>
          </ul>
        </li>
        <li class="search">
          <a href="/inquire/explain.aspx">查詢</a>
          <ul class="subL1">
              <li>
                 <a href="#">包裹查詢</a>
                   <ul class="subL2">
                      <li><a href="/Inquire/explain.aspx">包裹查詢說明</a></li>
                      <li><a href="/Inquire/Trace.aspx">一般包裹查詢</a></li> 
                      <li><a href="/Inquire/TraceContinus.aspx">連號包裹查詢</a></li>
                      <li><a href="/inquire/International.aspx">國際包裹查詢</a></li>
                   </ul>
              </li>
              <li>
                <a href="#">運送及送達時間查詢</a>
                  <ul class="subL2">
                      <li><a href="/Inquire/timesheet1.aspx">送達時間說明</a></li>
                      <!-- <li><a href="/Inquire/timesheet2.aspx">送達時間試算</a></li>  -->
                      <li><a href="/Inquire/timesheet3.aspx">運費說明</a></li>
                      <!-- <li><a href="/Inquire/timesheet4.aspx">運費試算</a></li> -->
                  </ul>                    
              </li>
              <li>
                <a href="#">服務據點查詢</a>
                  <ul class="subL2">
                      <li><a href="/Inquire/Foothold.aspx">黑貓營業所查詢</a></li>
                      <li><a href="/Inquire/SubStore.aspx">合作代收店查詢</a></li> 
                      <li><a href="/Inquire/Golf.aspx">合作代收高爾夫球場</a></li>
                      <li><a href="/Inquire/hotel.aspx">合作代收飯店</a></li>                                                            
                   </ul>
              </li>
             <!--  <li>
                 <a href="/Inquire/Office.aspx">區碼查詢</a>
              </li> -->
          </ul>
        </li>
        <li class="inquiry">
         <a href="/qa/services.aspx">客服中心</a>
          <ul class="subL1">
              <li>
                 <a href="#">常見問題</a>
                  <ul class="subL2">
                      <li><a href="/qa/services.aspx">宅配服務</a></li>
                      <li><a href="/qa/chtotw.aspx">兩岸跨境專區</a></li> 
                      <li><a href="/qa/member.aspx">官網會員</a></li> 
                      <li><a href="/qa/others.aspx">其他</a></li>
                      <li><a href="/contract/ezcat.aspx?type=4">ezcat下載</a></li>                                                            
                  </ul>
              </li>
              <li>
                <a href="#">聯絡黑貓</a>
                  <ul class="subL2">
                      <li><a href="/CallCenter/WebContact.aspx">網路客服</a></li>
                      <li><a href="/CallCenter/WebQuery.aspx">網路客服進度查詢</a></li> 
                      <li><a href="/CallCenter/service.aspx">客服專線</a></li>
                      <li><a href="/CallCenter/service02.aspx">自動語音預約寄件專線</a></li>
                  </ul>
              </li>                                                             
          </ul>
        </li>        
      </ul>
    </div>
<script type="text/javascript">
function checkForm(){
   var keyStr =document.getElementById("keyword")
   if(keyStr.value == ""){
       alert("請您先輸入關鍵字");
       return false;
   }
   return true ;

}

function GSearch() {
   //alert($("#keyword").val());
   //return;
   if ($("#keyword").val() == "") {
       alert("請您先輸入關鍵字");
       return false;
   }
   //alert('location');
   
   location = '/result.aspx?q=' + $("#keyword").val();
   return false;
}
</script>


<script type="text/javascript">
      // menuid is defined in decorator
      $(document).ready(function () {
          $("#mainNav li").hover(makeShow, makeHide);
     }); 

      function makeShow() {
          $(this).children('ul').show();
      }

      function makeHide() {
          $(this).children('ul').hide();
      }

</script>
     <div class="searchBox">
      <input name="q" id="keyword" type="text" value="站內搜尋" class="searchTxt" onclick="if(this.value=='站內搜尋') this.value='';">
      <!--<xinput name="" type="button" class="searchbutton" src="/img/searchbutton.gif" onclick="search();void();" />-->
      <a class="searchbutton" href="javascript:GSearch();"><img src="/img/searchbutton.gif" border="0"></a>
    </div>
      <!--
  <input type="hidden" name="cx" value="005475758396817196247:vpg-mgvhr44" />
  <input type="hidden" name="cof" value="FORID:11" />
  <input type="hidden" name="ie" value="UTF-8" />
      -->
  </div>
</div>

<!----------------------------------------/header----------------------------------------------->

<!-------------------------------------contentContainer----------------------------------------->
<div id="contentContainer">
  


<div id="contentContainer">
  <!-------------------------------------contentContainer aside--------------------------------->
  


<script type="text/javascript">
  var LeftMenuItemIndex = "";
</script>
<script src="/js/LeftMenu.js" type="text/javascript"></script>


<div id="aside">
    <div class="lNavTgBoxB">
      <div class="lNavTgBoxM">
        <div class="lNavTt1 m3">
          <h2>查詢</h2>
        </div>
        <div class="lNavTg">
          <p class="icoOpen">包裹查詢</p>
        </div>
        <ul>
          <li><a href="/Inquire/explain.aspx" id="ContentPlaceHolder1_ctl00_menuitem11">包裹查詢說明</a></li>
          <li><a href="/Inquire/Trace.aspx" id="ContentPlaceHolder1_ctl00_menuitem12">一般包裹查詢</a></li>
          <li><a href="/Inquire/TraceContinus.aspx" id="ContentPlaceHolder1_ctl00_menuitem13">連號包裹查詢</a></li>
          <li><a href="/Inquire/International.aspx" id="ContentPlaceHolder1_ctl00_menuitem14">國際包裹查詢</a></li>
        </ul>
        <div class="lNavTg">
          <p class="icoOpen">運送及送達時間查詢 </p>
        </div>
        <ul>
          <li><a href="/Inquire/timesheet1.aspx">送達時間說明</a></li>
          <!-- <li><a href="/Inquire/timesheet2.aspx">送達時間試算</a></li> -->
          <li><a href="/Inquire/timesheet3.aspx">運費說明</a></li>
          <!-- <li><a href="/Inquire/timesheet4.aspx">運費試算</a></li> -->
        </ul>
        <div class="lNavTg">
          <p class="icoOpen">服務據點查詢</p>
        </div>
        <ul>
          <li><a href="/Inquire/Foothold.aspx">黑貓營業所查詢</a></li>
          <li><a href="/Inquire/SubStore.aspx">合作代收店查詢</a></li>
          <li><a href="/Inquire/Golf.aspx">合作代收高爾夫球場</a></li>
          <li><a href="/Inquire/hotel.aspx">合作代收飯店</a></li>
        </ul>
        <!-- <div class="lNavTg">
          <p class="icoNone"><a href="Office.aspx">區碼查詢</a></p>
        </div> -->
      </div>
    </div>
    <div>
      <img src="/img/asidebanner.gif" usemap="#Map">
      <map name="Map" id="Map">
          <area shape="rect" coords="15, 104, 212, 146" href="/consign/sheet/sheetAdd.aspx">
      </map>
    </div>
  </div>

  <!-------------------------------------/contentContainer aside-------------------------------->
  
  <!-------------------------------------contentContainer main---------------------------------->
  <div id="main">
    <div class="breadcrumb">
      <ul class="icoHome">
        <li><a href="../Default.aspx">首頁</a></li>
          <li><span>查詢</span></li>
          <li><span>包裹查詢</span></li>                 
        <li>一般包裹查詢</li>
      </ul>
    </div>
    
    <!--contentsArea-------------------------------------------------->
    <div class="contentsArea">
      <div class="contentsOne">
        <h2 class="typeA">一般包裹查詢</h2>
        <div class="contentsBtm">
          <div class="contentsInner">
          
            <div class="articleTypeA">
              <p class="paddingR18L10">您所輸入的包裹查詢號碼以及查詢結果如下:   </p>
              <!--<p class="paddingR18L10">點選包裹查詢號碼，可以查詢包裹的歷史狀態；點選營業所可查詢營業所聯絡方式 </p>-->
              <p class="paddingR18L10">&nbsp;</p>
              <table cellpadding="0" cellspacing="0" class="tablelist">
                <tbody><tr class="top">
                  <td height="38">包裹查詢號碼</td>
                  <td>目前狀態</td>
                  <td>資料登入時間</td>
                  <td>負責營業所</td>
                  <!--
                  <td>配送人員</td>
                  -->
                </tr>
                 
              </tbody></table>
              <p>&nbsp;</p>			     
              
              
                                      <div align="center">
                                      <!--
                                          <a onmouseover="MM_swapImage('Image53','','../images/inquery/p-bt3r.gif',1)" onmouseout="MM_swapImgRestore()"
                                              href="#" onclick="window.history.back();">
                                              <img height="22" src="../images/inquery/p-bt3.gif" width="66" border="0" name="Image53"></a>-->

                                              <input type="button" class="whiteBtn" value="回上一步" onclick="history.back();">
                                              
                                              <!--
                                              <a href="Trace.aspx" id="ContentPlaceHolder1_hlkReturn" onmouseover="MM_swapImage(&#39;Image39&#39;,&#39;&#39;,&#39;../images/inquery/bt12r.gif&#39;,1)" onmouseout="MM_swapImgRestore()"><img height="22"
                                                      src="../images/inquery/bt12.gif" width="80" border="0" name="Image39"></a> -->

                                              <input type="button" class="greenBtn" value="重新查詢" onclick="location='trace.aspx';">


                                                      

                                         
                                       </div>
              <br>
                     
             <ul class="listdot paddingR18L10">
                <li>包裹狀態說明<br>
                  1.若對於包裹狀態說明不清楚，可參閱<a href="statuslist.aspx" target="_blank">貨態定義一覽表</a>。<br>
                  2.若資料庫尚未能查詢到該筆貨物追蹤查詢號碼狀態，可能原因如下：<br>
                  &nbsp;&nbsp;&nbsp;a.資料尚在處理中。<br>
                  &nbsp;&nbsp;&nbsp;b.該筆包裹查詢號碼查無狀態。<br>
                </li>
                <li>若您輸入單號正確，卻查詢不到包裹狀態，有可能是因為資料尚在處理中，請稍候再試。</li>
                <li>
                  <p>資料登入時間為SD輸入包裹狀態的時間。</p>
                </li>
                <li>資料保留時間僅為三個月，您將無法查詢三個月之前的資料。</li>                  
                <li>若有任何問題請使用<a href="/CallCenter/WebContact.aspx">網路客服</a>或撥打客服專線412-8888(手機加02)，由客服人員為您查詢。</li>
             </ul>
            </div> 
                                       
          </div>
        </div>
      </div>
    </div>
    <!--/contentsArea-------------------------------------------------->
    
    
    
    
    
  </div>
  <!-------------------------------------/contentContainer main--------------------------------->
</div>


</div>
<!-------------------------------------/contentContainer---------------------------------------->



<!----------------------------------------footer------------------------------------------------>

<!----------------------------------------quicklink--------------------------------------------->
<div id="quicklinkContainer">
  <div id="quicklink">
    <div class="block01">        	
          <h4>企業情報</h4>
             <ul>
                <li><a href="/company/about.aspx">企業簡介</a></li>
                <li><a href="/news/overview.aspx">最新消息</a></li>
                <li><a href="/humanresource/job1.htm">黑貓宅急便徵才</a></li>
                <li><a href="/company/group.aspx">相關企業</a></li>
                <li><a href="mailto:stakeholders@mail.t-cat.com.tw?subject=利害關係人事件反應">利害關係人</a></li>
             </ul>            
      </div>
      <div class="block02">        	
          <h4>契約客戶</h4>
             <ul>
                 <!-- <li><a href="http://www.scmcat.com.tw/" target="_blank">SCM供應鏈平台</a></li> -->
                <li><a href="/contract/explain.aspx">印單軟體</a></li>
                <li><a href="/contract/status.aspx">包裹狀態查詢介紹</a></li>
                <li><a href="/contract/ezcat.aspx">ezcat印單軟體下載</a></li>
                <li><a href="/contract/scat.aspx">SmartCat APP</a></li> 
                <li><a href="/contract/business.aspx">契約客戶專區</a></li> 
                <!--<li><a href="/CallCenter/WebContact.aspx?type=2">業務洽談</a></li> -->
                <li><a href="https://www.ccat.com.tw/Home/Index" target="_blank">宅急便客樂得</a></li>               
             </ul>            
      </div>
      <div class="block03">        	
          <h4>訂購服務</h4>
             <ul>
                <li><a href="/Product/ProductList.aspx?CateId=2">包裝資材</a></li>
<!--                  <li><a href="/Product/ProductList.aspx?CateId=3">輕‧生活用品</a></li>             -->
             </ul>            
      </div>
      <div class="block04">        	
          <h4>黑貓心樂園</h4>
             <ul>
                <li><a href="/heart/index.html" xonclick="alert('Coming Soon');">黑貓先生的一天</a></li>
                <li><a href="/heart/story.aspx" xonclick="alert('Coming Soon');">貓友小故事</a></li>
                <li><a href="/heart/advertisement.html" xonclick="alert('Coming Soon');">黑貓微頻道</a></li>
                <li><a href="/heart/download.html" xonclick="alert('Coming Soon');">黑貓桌布</a></li>
                <li><a href="/heart/ecard.aspx" xonclick="alert('Coming Soon');">電子賀卡</a></li>          
             </ul>            
      </div>
      <div class="block05">        	
          <h4>線上社群</h4>
             <ul>
                <li><a href="https://www.facebook.com/takkyubin">Facebook</a></li>
                <li><a href="http://www.youtube.com/MrCat4128888">YouTube</a></li>                         
             </ul>            
      </div>
    <div class="block06">        	
       <h4>Mobile Site</h4>
           <ul>
              <li><a href="/mobile/"><img src="/img/urcode.gif" width="75" height="75"></a></li>                                  
           </ul>            
      </div>
      <div class="block07">        	
        <h4></h4>
         <ul style="display:block; margin-top:25px; ">
           <li style="margin:0 0 5px 0;"><a href="/humanresource/job1.htm"><img src="/img/fbanner01.jpg" width="130" height="49"></a></li>
           <li><a href="http://103.234.81.14/invoice_query.aspx" target="_blank"><img src="/img/fbanner02.jpg" width="130" height="49"></a></li>                          
         </ul>            
      </div>
</div>
</div>
<!----------------------------------------/quicklink-------------------------------------------->


<!----------------------------------------footer------------------------------------------------>
<div id="footerContainer">
  <div id="footer">
    <p class="copyright">版權所有 © 2022 統一速達股份有限公司</p>
    <ul class="nav">
      <li><a href="/Sitemap.aspx">網站地圖</a></li>
      <li><a href="/member/privacy.aspx" target="_blank">隱私權聲明</a></li>
      <li><a href="/send/clause.aspx">託運條款</a></li>
      <li><a href="http://61.57.228.69/Happinesspassbook/login.aspx" style="border-right:none;" target="_blank">員工專區</a></li>
    </ul>
    
    <ul class="logo">
      <li class="l1"><a href="http://www.sosa.org.tw/ec/ec_info.asp?markid=70762591" target="_blank">優良電子商店</a></li>
      <li class="l2"><a href="http://www.sosa.org.tw/ec/ec_infotransparency.asp?markid=70762591" target="_blank">資訊透明化電子商店</a></li>
      <li class="l3"><a href="http://www.globaltrust.com.tw/trustseal/seal.asp?id=CEOV190506797025&amp;website=www.t-cat.com.tw&amp;lang=en" target="_blank">GlobalSign</a>
  </li>
<!--        <li class="l4"><a href="#here">ISO認證標章</a></li>       -->
    </ul>      
      
  </div>
</div>

<!----------------------------------------/footer----------------------------------------------->


<!----------------------------------------/footer----------------------------------------------->
  
</div>


</form>

<div id="pnlGoogleAnalytics">


<!--googlelcode-->
<script type="text/javascript">

  var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");

  document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));

</script><script src="https://ssl.google-analytics.com/ga.js" type="text/javascript"></script>

<script type="text/javascript">
  if (_gat != undefined) {
      //var pageTracker = _gat._getTracker("UA-4888179-1");
      var pageTracker = _gat._getTracker("UA-206063462-1");
      pageTracker._trackPageview();
  }
</script>


</div>


    <!-- 智能客服  -->
  <script type="text/javascript" var="" useragent="navigator.userAgent;" if="" (useragent.search("iphone")="=-1" &&="" useragent.search("android")="=-1" useragent.search("windows="" phone")="=-1" &&useragent.search("ipad")="=-1)" {="" src="https://neko.t-cat.com.tw/webchat/WebChatEntry.js" ;="" }="">
  </script><div id="EcpWebChatEntryButton" class=""><div class="EcpWebChat_text"></div><div class="EcpWebChat_arrow">&nbsp;</div></div>



</body></html>`,
};

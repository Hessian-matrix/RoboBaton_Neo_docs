# 首页产品模型

首页带壳模型为统一外观基准。首页与接口展示共用 enclosure-model.js 的几何、配色、哑光材质与光照，统一镜头环、底部接缝、侧面开关和 TF 槽。接口区保留引脚连线、USB 与 TF 插入演示；TF 模式临时半透明以展示卡片，切回其他模式恢复不透明。回归运行 tools/check_enclosure.cjs，截图位于 release/unified-enclosure。

裸机几何来自用户提供的 `相机板V2.step`，保留 PCB、镜头、支架、安装孔、连接器及板两面的元件，不再由几组方块近似。CAD 导出为 GLB 后通过 `tools/prepare_product_glb.py` 删除器件型号等命名元数据，产物为 `site/product-v2.glb`。原始 STEP 不发布。材质为网页展示调整，非实物颜色认证。

该 STEP 中 PCB 约 40.01 × 19.97 mm；含突出元件的包围盒为 41.00 × 19.97 × 18.10 mm。几何不缩放，显示时仅统一坐标与单位。页面既有 40 × 20 × 19.5 mm 是产品名义规格，不以 CAD 包围盒改写；裸机画布不再画与 CAD 高度不一致的 19.5 mm 测量线。带壳外观仍是既有示意几何，不声称来自这份 STEP。

`product-cad.js` 使用同版本 Three.js 的 GLTFLoader，加入镜片、金属、PCB 的哑光配色与柔和漫反射光照；不使用环境反射、高光、清漆或人工白色反光点。新增 GLTFLoader.js 与 BufferGeometryUtils.js 来自 three@0.160.0，使用随站点发布的 three-LICENSE.txt（MIT）；导入路径改为本地资源，运行时不请求 CDN。首页水平可完整旋转，俯仰范围为 ±1.5 rad，可查看底面。原有尺寸投影与指针/键盘操作保持一致。

只有首页使用详细 CAD；轨迹演示继续使用轻量模型，避免自动播放反复渲染大量元件。GLB 加载失败、WebGL 不可用或上下文丢失时使用原有深度测试模型。首页不依赖 CAD 后台服务。

更新步骤：`cad export <STEP> tmp/camera-v2.glb`，准备同版本 Three.js 辅助文件于 tmp，然后运行 `python3 tools/prepare_product_glb.py tmp/camera-v2.glb`、`python3 tools/version_assets.py` 和正常站点构建。

回归：`node tools/check_cad.cjs` 检查几何尺寸、裸机/带壳共 108 个视角、320 px 布局和拖动、模型资源失败回退及 JS 错误。`node tools/check_model.cjs` 检查原有 GPU/软件深度路径及轨迹控制。PLAYWRIGHT_MODULE、CHROME_PATH、SITE_URL、MODEL_TEST_OUTPUT 的用法同 README，截图和结果存放 release/cad-v2。桌面 Chromium 自动化通过不表示已经覆盖全部手机 GPU。

---
docId: fcABV_l3FcESqJjc9F11IFC0k
title: "关于我是如何使用skills 来管理项目文档"
url: https://docs.corp.kuaishou.com/d/home/fcABV_l3FcESqJjc9F11IFC0k
lastSync: 2026-01-30T15:23:27.015762
---

关于我是如何使用skills 来管理项目文档

你是否有 ai 生成了文档过多的烦恼？

**你是否有ai 生成的文档更新不及时、和代码不同步的烦恼？**

**你是否有ai 生成的文档不方便分享查看的文档？**

没关系，这一次通通帮你解决！

隆重介绍两个skills ，skill仓库

**tech-doc-organizer： 文档整理工具，帮你解决项目内文档泛滥过多的问题**

**doc-shuttle：文档穿梭机，解决文档在本地项目和公司 docs系统更新同步文档。只需要一句话就支持将你仓库中的md文件变身为 docs 文档连接。**

tech-doc-organizer 技能介绍

## 当用户说以下关键词时，会触发此技能：

**常规文档操作**

### "整理文档" / "优化文档" / "检查文档"

"更新文档"

"精简文档" / "精简过长文档"

**"归档文档" / "旧文档归档"**

**特定场景**

### "总结到文档" / "记录到文档" / "保存到文档" / "写入文档"

**"根据代码变更更新文档" / "检查 diff 更新文档"**

**"文档和代码不一致"**

**默认交互流程**

### 当用户只说 "整理文档" 而没有指定具体操作时，会展示选项菜单：

```Plain/Text
请选择文档操作:
1. 扫描文档 - 检查问题（一致性、lint、组织）
2. 精简文档 - AI 精简过长文档
3. 归档文档 - 归档旧文档
4. 更新文档 - 根据代码变更和任务更新
5. 重组文档 - 合并/拆分/重组
6. 总结到文档 - 将当前任务总结保存
```

doc-shuttle 技能介绍

快手内网 Docs 文档与本地 Markdown 双向同步工具。

触发关键词

#### 关键词

功能

**上传文档到 Docs / 发布到 Docs**

**上传 MD 文件到 Docs**

**从 Docs 拉取 / 同步文档**

**从 Docs 拉取文档到本地**

**更新 Docs 文档 / 更新文档**

**更新已存在的 Docs 文档**

**把这个 MD 上传到文档系统**

**上传指定 MD 文件**

****

tech-doc-organizer 如何创建的？

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:3801199447059453347fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

其实只需要一句话，调用 skill-creator 帮你创建即可，整个过程中会创建很多脚本和工作流来处理文档精简工作，避免占用上下文。实际使用有不符合预期的地方直接让她改到符合你预期的效果即可。

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:-2950726900703775061fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

核心用法展示：

更新文档：skills 会根据当前会话内容或git 变更来更新文档

整理文档：会扫描整项目内的文档，统一命令格式，划分不同分类，输出overview索引对应的文档

doc-shuffle 如何创建的？

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:2884063257484035948fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:-5018220173079697438fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

这块儿由于需要和系统做一些打通，存在鉴权问题，稍有一些困难； 可以参考世面上其他skills 普遍会用cdp 协议调用浏览器来实现。

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:-8269982745120567753fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

不过可以先让ai 使用浏览器工具探索一下docs 功能，收集一些有用的接口，结合一下。docs 导入支持现成的api，只需要维护一些token鉴权信息。

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:-8833606998520086686fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

docs 由于是虚拟滚动渲染，导致很难获取全量的html 结构，ai 探索到了合适的接口，但数据是私有协议，让ai 实现一层数据结构自动转换，整体过程需要ai 的一些试错尝试，最终效果如下：

![](https://docs.corp.kuaishou.com/image/api/external/load/out?code=fcABV_l3FcESqJjc9F11IFC0k:-64257934665887395fcABV_l3FcESqJjc9F11IFC0kfcABV_l3FcESqJjc9F11IFC0k:1769757807015)

**既能快速拉到项目内，让ai 编辑优化一波文档之后，重新上传也可以正确识别。**

